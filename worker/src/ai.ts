// Provider 抽象：OpenAI 兼容端点 + Cloudflare Workers AI + Google 免费翻译三级容灾
// 保证当外部 API 欠费、挂掉或超时时，100% 能够降级翻译成中文并明确在日志/UI 告警

import {
  TRANSLATE_SYSTEM,
  buildTranslateUserPrompt,
  SUMMARY_SYSTEM,
  buildSummaryUserPrompt,
} from './prompts.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiEnv {
  AI?: any; // Cloudflare Workers AI binding
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_FALLBACK_MODEL?: string;
}

export interface ChatResult {
  text: string;
  model: string;
  fallback?: boolean;
  warning?: string;
}

function baseUrl(env: AiEnv): string {
  const b = (env.AI_BASE_URL ?? '')
    .trim()
    .replace(/^[\uFEFF\xA0\s]+/, '')
    .replace(/\/+$/, '');
  return b || 'https://api.openai.com/v1';
}

/** Level 1: 调用配置的 OpenAI 兼容端点（Gemini / OpenRouter / OpenAI） */
export async function callModel(
  env: AiEnv,
  model: string,
  messages: ChatMessage[],
  timeoutMs = 45000,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl(env)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(env.AI_API_KEY ?? '').trim().replace(/^[\uFEFF\xA0\s]+/, '')}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        stream: false,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`AI ${model} HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`AI ${model} 返回空内容`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Level 2: Cloudflare Workers AI 内网大模型或专用翻译模型 */
export async function callWorkersAi(
  env: AiEnv,
  messages: ChatMessage[],
  timeoutMs = 30000,
): Promise<string> {
  if (!env.AI) throw new Error('未配置 Cloudflare Workers AI 绑定');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // 优先使用 Workers AI 的 Qwen 聊天模型
    const res = (await env.AI.run('@cf/qwen/qwen1.5-7b-chat', {
      messages,
      max_tokens: 2048,
    })) as { response?: string };
    const text = res?.response?.trim();
    if (!text) throw new Error('Workers AI @cf/qwen/qwen1.5-7b-chat 返回空内容');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Level 2 变体：Cloudflare Workers AI 专用翻译模型 (Meta m2m100) */
export async function callWorkersAiTranslate(
  env: AiEnv,
  text: string,
  timeoutMs = 20000,
): Promise<string> {
  if (!env.AI) throw new Error('未配置 Cloudflare Workers AI 绑定');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = (await env.AI.run('@cf/meta/m2m100-1.2b', {
      text,
      source_lang: 'en',
      target_lang: 'zh',
    })) as { translated_text?: string };
    const out = res?.translated_text?.trim();
    if (!out) throw new Error('Workers AI @cf/meta/m2m100-1.2b 返回空内容');
    return out;
  } catch (err) {
    // 若专用翻译模型不可用，尝试 Qwen 对话模型翻译
    return callWorkersAi(
      env,
      [
        { role: 'system', content: TRANSLATE_SYSTEM },
        { role: 'user', content: buildTranslateUserPrompt(text) },
      ],
      timeoutMs,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Level 3: Google 网页公共翻译通道（免 API Key、零配额限制、毫秒级响应） */
export async function callGoogleTranslate(text: string, timeoutMs = 10000): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
    const data = (await res.json()) as unknown;
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const parts = data[0]
        .map((item: unknown) =>
          Array.isArray(item) && typeof item[0] === 'string' ? item[0] : '',
        )
        .filter(Boolean);
      const out = parts.join('').trim();
      if (out) return out;
    }
    throw new Error('Google Translate 返回数据无法解析');
  } finally {
    clearTimeout(timer);
  }
}

/** 智能翻译降级通道：三级漏斗保障（主模型 -> 备用模型 -> Workers AI -> Google Translate） */
export async function translateContent(
  env: AiEnv,
  text: string,
): Promise<ChatResult> {
  const primary = env.AI_MODEL || 'gpt-4o-mini';
  const fallback = env.AI_FALLBACK_MODEL;
  const messages: ChatMessage[] = [
    { role: 'system', content: TRANSLATE_SYSTEM },
    { role: 'user', content: buildTranslateUserPrompt(text) },
  ];

  // 1. 尝试主外部模型
  if (env.AI_API_KEY) {
    try {
      const res = await callModel(env, primary, messages);
      return { text: res, model: primary };
    } catch (errPrimary) {
      console.warn('[translation] primary model failed', { primary, error: String(errPrimary) });
      // 1.1 尝试备用外部模型
      if (fallback && fallback !== primary) {
        try {
          const resFallback = await callModel(env, fallback, messages);
          return {
            text: resFallback,
            model: fallback,
            fallback: true,
            warning: `主模型不可用，已自动切换为备用模型 ${fallback}`,
          };
        } catch (errFallback) {
          console.warn('[translation] fallback model failed', { fallback, error: String(errFallback) });
        }
      }
    }
  }

  // 2. 尝试 Cloudflare Workers AI（内网零配额/每日 10k 免费神经元）
  if (env.AI) {
    try {
      console.info('[translation] attempting Cloudflare Workers AI fallback');
      const textResult = await callWorkersAiTranslate(env, text);
      return {
        text: textResult,
        model: 'cf:workers-ai',
        fallback: true,
        warning: '外部 AI 异常，已自动切换至 Cloudflare Workers AI 备用翻译',
      };
    } catch (errWorkersAi) {
      console.warn('[translation] Workers AI failed', { error: String(errWorkersAi) });
    }
  }

  // 3. 终极绝对保底：Google 免费翻译通道
  try {
    console.info('[translation] attempting Google Translate engine fallback');
    const googleResult = await callGoogleTranslate(text);
    return {
      text: googleResult,
      model: 'google-translate',
      fallback: true,
      warning: '大模型服务暂不可用，已自动切换至 Google 翻译引擎保底',
    };
  } catch (errGoogle) {
    console.error('[translation] all translation channels exhausted', { error: String(errGoogle) });
    throw new Error('所有翻译通道（主模型/Workers AI/Google翻译）均暂时不可用，请稍后重试');
  }
}

/** 通用 Chat：用于摘要等复杂指令生成（主模型 -> 备用模型 -> Workers AI） */
export async function chat(env: AiEnv, messages: ChatMessage[]): Promise<ChatResult> {
  const primary = env.AI_MODEL || 'gpt-4o-mini';
  const fallback = env.AI_FALLBACK_MODEL;

  if (env.AI_API_KEY) {
    try {
      return { text: await callModel(env, primary, messages), model: primary };
    } catch (err) {
      if (fallback && fallback !== primary) {
        console.warn('[ai] primary failed, using fallback', { primary, fallback, error: String(err) });
        try {
          return {
            text: await callModel(env, fallback, messages),
            model: fallback,
            fallback: true,
            warning: `主模型已切换为备用模型 ${fallback}`,
          };
        } catch (fallbackErr) {
          console.warn('[ai] fallback model also failed', { fallback, error: String(fallbackErr) });
        }
      }
    }
  }

  // 尝试 Workers AI 兜底
  if (env.AI) {
    try {
      console.info('[ai] chat falling back to Cloudflare Workers AI');
      const text = await callWorkersAi(env, messages);
      return {
        text,
        model: 'cf:qwen1.5-7b-chat',
        fallback: true,
        warning: '外部 AI 不可用，已由 Cloudflare Workers AI 兜底生成',
      };
    } catch (errWorkersAi) {
      console.warn('[ai] chat Workers AI failed', { error: String(errWorkersAi) });
    }
  }

  throw new Error('AI 生成服务暂时不可用，请稍后重试');
}
