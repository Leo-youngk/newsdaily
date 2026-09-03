import {
  callModel,
  callWorkersAiTranslate,
  callGoogleTranslate,
  type AiEnv,
} from './ai.js';
import {
  BATCH_TRANSLATE_SYSTEM,
  buildBatchTranslatePrompt,
  parseBatchTranslateResponse,
} from './prompts.js';

interface TranslationEnv extends AiEnv {
  NEWS_R2: R2Bucket;
}

export interface ParagraphInput {
  key: string;
  text: string;
}

export interface ParagraphResult {
  key: string;
  text?: string;
  model?: string;
  cached?: boolean;
  cacheSaved?: boolean;
  error?: string;
}

async function contentKey(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`translation-v2\n${text}`),
  );
  return `translations/v2/${Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')}.json`;
}

/** 每段独立缓存 + 三级容灾；成功段不丢失，失败段自动降级至 Workers AI 或 Google 翻译保底 */
export async function translateParagraphBatch(
  env: TranslationEnv,
  inputs: ParagraphInput[],
) {
  const warnings = new Set<string>();
  const keys = await Promise.all(inputs.map((p) => contentKey(p.text)));
  const results: ParagraphResult[] = inputs.map((p) => ({ key: p.key }));

  // 1. 尝试从 R2 读取已有段落译文
  await Promise.all(
    inputs.map(async (_p, i) => {
      try {
        const cached = await env.NEWS_R2.get(keys[i]);
        if (!cached) return;
        const value = await cached.json<{ text?: string; model?: string }>();
        if (typeof value.text === 'string' && value.text.trim()) {
          results[i] = {
            key: inputs[i].key,
            text: value.text,
            model: value.model,
            cached: true,
            cacheSaved: true,
          };
        }
      } catch (err) {
        console.warn('[translation] cache read failed', err);
        results[i].error = '云端缓存暂时无法读取，请稍后重试';
      }
    }),
  );

  // 2. 外部主备大模型批处理尝试
  const models = [
    ...new Set(
      [env.AI_MODEL || 'gpt-4o-mini', env.AI_FALLBACK_MODEL].filter(
        (v): v is string => !!v,
      ),
    ),
  ];
  let lastError = '模型没有返回该段译文';

  for (let attempt = 0; attempt < models.length; attempt++) {
    const missing = inputs
      .map((_p, i) => i)
      .filter((i) => !results[i].text && !results[i].error);
    if (!missing.length) break;
    const model = models[attempt];
    if (attempt > 0) {
      warnings.add(`部分段落已尝试备用模型 ${model}`);
      console.warn('[translation] fallback', { model, paragraphs: missing.length });
    }
    try {
      if (!env.AI_API_KEY) throw new Error('未配置 AI_API_KEY');
      const response = await callModel(env, model, [
        { role: 'system', content: BATCH_TRANSLATE_SYSTEM },
        {
          role: 'user',
          content: buildBatchTranslatePrompt(missing.map((i) => inputs[i].text)),
        },
      ]);
      const parsed = parseBatchTranslateResponse(response, missing.length);
      await Promise.all(
        missing.map(async (i, j) => {
          const text = parsed[j]?.trim();
          if (!text) return;
          results[i] = { key: inputs[i].key, text, model, cacheSaved: false };
          try {
            await env.NEWS_R2.put(
              keys[i],
              JSON.stringify({ text, model }),
              {
                httpMetadata: { contentType: 'application/json; charset=utf-8' },
              },
            );
            results[i].cacheSaved = true;
          } catch (err) {
            console.warn('[translation] cache write failed', err);
            warnings.add('部分译文未保存到云端，已返回本机保留');
          }
        }),
      );
      lastError = '模型没有返回该段译文';
    } catch (err) {
      console.warn('[translation] model failed', { model, error: String(err) });
      lastError = `翻译服务 ${model} 暂时不可用`;
    }
  }

  // 一轮最多补三段短文本，控制最坏耗时在任务租约内。
  // 长段会进入自动拆分重试，防止专用翻译模型截断长输入。
  const stillMissing = inputs
    .map((_p, i) => i)
    .filter((i) => !results[i].text && !results[i].error && inputs[i].text.length <= 800).slice(0, 3);
  if (stillMissing.length > 0 && env.AI) {
    warnings.add('外部 AI 异常，部分段落已尝试 Cloudflare Workers AI 备用通道');
    console.info('[translation] attempting Workers AI for missing paragraphs', {
      count: stillMissing.length,
    });
    // 并发 3 段逐段由 Workers AI 翻译
    for (let c = 0; c < stillMissing.length; c += 3) {
      const chunk = stillMissing.slice(c, c + 3);
      await Promise.all(
        chunk.map(async (i) => {
          try {
            const text = await callWorkersAiTranslate(env, inputs[i].text);
            if (text) {
              const model = 'cf:workers-ai';
              results[i] = { key: inputs[i].key, text, model, cacheSaved: false };
              try {
                await env.NEWS_R2.put(
                  keys[i],
                  JSON.stringify({ text, model }),
                  {
                    httpMetadata: { contentType: 'application/json; charset=utf-8' },
                  },
                );
                results[i].cacheSaved = true;
              } catch (writeErr) {
                console.warn('[translation] cache write failed', writeErr);
                warnings.add('段落复用缓存写入失败，译文将随任务保存');
              }
            }
          } catch (cfErr) {
            console.warn('[translation] Workers AI paragraph failed', {
              key: inputs[i].key,
              error: String(cfErr),
            });
          }
        }),
      );
    }
  }

  // 公共翻译通道也可能失败；未完成的段落交回持久化任务继续重试。
  const finalMissing = inputs
    .map((_p, i) => i)
    .filter((i) => !results[i].text && !results[i].error && inputs[i].text.length <= 800).slice(0, 3);
  if (finalMissing.length > 0) {
    warnings.add('大模型不可用，部分段落已尝试 Google 翻译引擎');
    console.info('[translation] attempting Google Translate engine for missing paragraphs', {
      count: finalMissing.length,
    });
    for (let c = 0; c < finalMissing.length; c += 3) {
      const chunk = finalMissing.slice(c, c + 3);
      await Promise.all(
        chunk.map(async (i) => {
          try {
            const text = await callGoogleTranslate(inputs[i].text);
            if (text) {
              const model = 'google-translate';
              results[i] = { key: inputs[i].key, text, model, cacheSaved: false };
              try {
                await env.NEWS_R2.put(
                  keys[i],
                  JSON.stringify({ text, model }),
                  {
                    httpMetadata: { contentType: 'application/json; charset=utf-8' },
                  },
                );
                results[i].cacheSaved = true;
              } catch (writeErr) {
                console.warn('[translation] cache write failed', writeErr);
                warnings.add('段落复用缓存写入失败，译文将随任务保存');
              }
            }
          } catch (gErr) {
            console.warn('[translation] Google Translate paragraph failed', {
              key: inputs[i].key,
              error: String(gErr),
            });
          }
        }),
      );
    }
  }

  for (const result of results) {
    if (!result.text && !result.error) result.error = lastError;
  }
  return { results, warnings: [...warnings] };
}
