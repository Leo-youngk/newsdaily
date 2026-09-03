import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chat, translateContent, type AiEnv, type ChatMessage } from './ai.js';
import { translateParagraphBatch, type ParagraphInput } from './translations.js';
import {
  createTranslationJob,
  getTranslationJob,
  runTranslationJob,
  runDueTranslationJobs,
} from './translation-jobs.js';
import {
  SUMMARY_SYSTEM,
  TRANSLATE_SYSTEM,
  buildSummaryUserPrompt,
  buildTranslateUserPrompt,
} from './prompts.js';

export interface Env extends AiEnv {
  NEWS_R2: R2Bucket;
  DB: D1Database;
  ADMIN_TOKEN?: string;
  /** 允许的前端来源，逗号分隔；留空则只允许同源与无 Origin 的请求 */
  CORS_ORIGIN?: string;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * CORS 分两级：
 *   /data/* 与 /api/health 是公开只读内容，放开任意来源 —— 收紧它没有安全收益，
 *     反而会在 CORS_ORIGIN 忘配时让整个前端读不到数据。
 *   其余（AI 调用、配置读写）必须落在 CORS_ORIGIN 白名单里。
 */
app.use('/*', async (c, next) => {
  const path = c.req.path;
  const isPublicRead =
    c.req.method === 'GET' && (path.startsWith('/data/') || path === '/api/health');

  if (isPublicRead) {
    return cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], maxAge: 86400 })(c, next);
  }

  const allow = (c.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    origin: (origin) =>
      origin && allow.length > 0 && (allow.includes('*') || allow.includes(origin))
        ? origin
        : undefined,
    allowHeaders: ['Content-Type', 'x-admin-token', 'If-Match'],
    exposeHeaders: ['ETag'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    maxAge: 86400,
  })(c, next);
});

function contentTypeFor(key: string): string {
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  if (key.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

/** 写操作与 AI 调用都要求管理令牌。未配置令牌时一律拒绝（fail closed）。 */
function requireToken(c: { env: Env; req: { header: (k: string) => string | undefined } }):
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string } {
  if (!c.env.ADMIN_TOKEN) {
    return { ok: false, status: 503, error: '服务端未配置 ADMIN_TOKEN，拒绝服务' };
  }
  if (c.req.header('x-admin-token') !== c.env.ADMIN_TOKEN) {
    return { ok: false, status: 401, error: '未授权' };
  }
  return { ok: true };
}

app.get('/', (c) => c.json({ ok: true, service: 'news-pwa-worker' }));
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

/**
 * GET /data/* —— 从 R2 读取并透传。
 * 显式使用 Cache API，并支持 If-None-Match 走 304。
 */
app.get('/data/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/data\//, ''));
  if (!key || key.includes('..')) return c.notFound();

  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const etag = cached.headers.get('ETag');
    if (etag && c.req.header('If-None-Match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return cached;
  }

  const isImage = key.startsWith('img/');
  const inm = c.req.header('If-None-Match');
  const obj = await c.env.NEWS_R2.get(key, inm ? { onlyIf: { etagDoesNotMatch: inm } } : undefined);
  if (!obj) return c.notFound();

  const headers = new Headers({
    'Content-Type': contentTypeFor(key),
    ETag: obj.httpEtag,
    'Cache-Control': isImage
      ? 'public, max-age=31536000, s-maxage=31536000, immutable'
      : 'public, max-age=60, s-maxage=300',
  });

  if (!('body' in obj) || obj.body == null) {
    return new Response(null, { status: 304, headers });
  }

  const res = new Response(obj.body, { headers });
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});

async function cacheGet(env: Env, k: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT result FROM ai_cache WHERE k = ?1')
    .bind(k)
    .first<{ result: string }>();
  return row?.result ?? null;
}

async function cachePut(
  env: Env,
  k: string,
  kind: string,
  model: string,
  result: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO ai_cache (k, kind, model, result, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(k) DO UPDATE SET result = excluded.result, model = excluded.model, created_at = excluded.created_at`,
  )
    .bind(k, kind, model, result, Date.now())
    .run();
}

/** 从 R2 取这条的正文 */
async function bodyTextFor(env: Env, id: string): Promise<string | null> {
  const obj = await env.NEWS_R2.get(`detail/${id}.json`);
  if (!obj) return null;
  try {
    const d = (await obj.json()) as { contentText?: string };
    return d.contentText ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/ai/summary  { id }
 */
app.post('/api/ai/summary', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  const { id } = await c.req.json<{ id: string }>().catch(() => ({ id: '' }));
  if (!id) return c.json({ error: '缺少 id' }, 400);

  const key = `sum:${id}`;
  const hit = await cacheGet(c.env, key);
  if (hit) return c.json({ text: hit, cached: true });

  const text = await bodyTextFor(c.env, id);
  if (!text) return c.json({ error: '该条没有可用正文' }, 404);

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: SUMMARY_SYSTEM },
      { role: 'user', content: buildSummaryUserPrompt(text) },
    ];
    const r = await chat(c.env, messages);
    await cachePut(c.env, key, 'summary', r.model, r.text);
    return c.json({
      text: r.text,
      model: r.model,
      fallback: r.fallback,
      warning: r.warning,
      cached: false,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

/**
 * POST /api/ai/translate  { id, field, text? }
 * 接入三级容灾翻译降级机制（主模型 -> Workers AI -> Google 翻译）
 */
app.post('/api/ai/translate', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  const { id, text, field } = await c.req
    .json<{ id: string; text?: string; field?: 'title' | 'body' }>()
    .catch(() => ({ id: '', text: undefined, field: undefined }));
  if (!id) return c.json({ error: '缺少 id' }, 400);

  const isTitle = field === 'title';
  const key = isTitle ? `trt:${id}` : `tr:${id}`;
  const hit = await cacheGet(c.env, key);
  if (hit) return c.json({ text: hit, cached: true });

  let source: string | null;
  if (isTitle) {
    source = (text ?? '').slice(0, 500);
    if (!source) return c.json({ error: '缺少标题文本' }, 400);
  } else {
    source = await bodyTextFor(c.env, id);
    if (!source) return c.json({ error: '该条没有可用正文' }, 404);
  }

  try {
    const r = await translateContent(c.env, source);
    await cachePut(c.env, key, 'translate', r.model, r.text);
    return c.json({
      text: r.text,
      model: r.model,
      fallback: r.fallback,
      warning: r.warning,
      cached: false,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

/**
 * GET /api/ai/bilingual?id=xxx
 * 读取整篇双语持久化缓存
 */
app.get('/api/ai/bilingual', async (c) => {
  const id = c.req.query('id');
  if (!id) return c.json({ error: '缺少 id' }, 400);
  const obj = await c.env.NEWS_R2.get(`bilingual/${id}.json`);
  if (!obj) return c.json({ cached: false });
  try {
    const data = (await obj.json()) as { translations?: string[] };
    if (Array.isArray(data?.translations)) {
      return c.json({ cached: true, translations: data.translations });
    }
  } catch {
    // ignore
  }
  return c.json({ cached: false });
});

/**
 * POST /api/ai/bilingual  { id, translations }
 * 存储整篇双语对照结果到 R2
 */
app.post('/api/ai/bilingual', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const { id, translations } = await c.req
    .json<{ id: string; translations: string[] }>()
    .catch(() => ({ id: '', translations: [] }));
  if (!id || !Array.isArray(translations)) {
    return c.json({ error: '缺少 id 或 translations 参数' }, 400);
  }
  await c.env.NEWS_R2.put(
    `bilingual/${id}.json`,
    JSON.stringify({ translations, updatedAt: Date.now() }),
    { httpMetadata: { contentType: 'application/json; charset=utf-8' } },
  );
  return c.json({ ok: true });
});

/**
 * POST /api/ai/translate-batch
 * 支持前端实时分批翻译（兼容 string[] 段落与 ParagraphInput[] 两种协议）
 */
app.post('/api/ai/translate-batch', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const payload = (await c.req.json().catch(() => null)) as any;
  if (!payload || !payload.paragraphs) {
    return c.json({ error: '无效请求格式' }, 400);
  }

  // 1. 兼容前端批量格式：{ id?: string, paragraphs: string[] }
  if (
    Array.isArray(payload.paragraphs) &&
    (payload.paragraphs.length === 0 || typeof payload.paragraphs[0] === 'string')
  ) {
    const rawList = payload.paragraphs as string[];
    if (!rawList.length) return c.json({ ok: true, translations: [] });
    if (rawList.length > 50) return c.json({ error: '单批段落过多（最多50段）' }, 400);

    const inputs: ParagraphInput[] = rawList.map((text, idx) => ({
      key: String(idx),
      text,
    }));
    const batchResult = await translateParagraphBatch(c.env, inputs);
    const translations = batchResult.results.map((r) => r.text || '');
    return c.json({
      ok: true,
      translations,
      warnings: batchResult.warnings,
      models: [...new Set(batchResult.results.map((r) => r.model).filter(Boolean))],
    });
  }

  // 2. 兼容结构化格式：{ paragraphs: ParagraphInput[] }
  const paragraphs = payload.paragraphs as ParagraphInput[];
  if (
    !Array.isArray(paragraphs) ||
    !paragraphs.length ||
    paragraphs.length > 100 ||
    paragraphs.some(
      (p) =>
        !p ||
        typeof p.key !== 'string' ||
        typeof p.text !== 'string' ||
        !p.text.trim(),
    )
  ) {
    return c.json({ error: '段落格式或长度无效' }, 400);
  }
  return c.json(await translateParagraphBatch(c.env, paragraphs));
});

/** 长文翻译任务化队列接口 */
app.post('/api/ai/jobs', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const payload = (await c.req.json().catch(() => null)) as {
    articleId?: string;
    paragraphs?: ParagraphInput[];
  } | null;
  const paragraphs = payload?.paragraphs;
  if (
    typeof payload?.articleId !== 'string' ||
    !payload.articleId ||
    payload.articleId.length > 200 ||
    !Array.isArray(paragraphs) ||
    !paragraphs.length ||
    paragraphs.length > 4000 ||
    paragraphs.some(
      (p) =>
        !p ||
        typeof p.key !== 'string' ||
        !/^[0-9.-]{1,100}$/.test(p.key) ||
        typeof p.text !== 'string' ||
        !p.text.trim() ||
        p.text.length > 4000,
    ) ||
    paragraphs.reduce((n, p) => n + p.text.length, 0) > 2000000 ||
    new Set(paragraphs.map((p) => p.key)).size !== paragraphs.length
  ) {
    return c.json({ error: '文章段落格式或长度无效' }, 400);
  }
  return c.json(await createTranslationJob(c.env, payload.articleId, paragraphs));
});

app.get('/api/ai/jobs/:id', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const id = c.req.param('id');
  if (!/^[a-f0-9]{64}$/.test(id)) return c.json({ error: '无效任务' }, 400);
  const job = await getTranslationJob(c.env, id);
  c.header('Cache-Control', 'no-store');
  return job ? c.json(job) : c.json({ error: '任务不存在' }, 404);
});

app.post('/api/ai/jobs/:id/run', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const id = c.req.param('id');
  if (!/^[a-f0-9]{64}$/.test(id)) return c.json({ error: '无效任务' }, 400);
  const job = await runTranslationJob(c.env, id);
  return job ? c.json(job) : c.json({ error: '任务不存在' }, 404);
});

/** R2 是配置的唯一来源，与采集进程一致。 */
app.get('/api/config', async (c) => {
  const obj = await c.env.NEWS_R2.get('config/sources.json');
  if (!obj) return c.json({ error: '尚无配置' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ETag: obj.httpEtag,
    },
  });
});

app.put('/api/config', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);
  const raw = await c.req.text();
  let config: {
    sources?: unknown[];
    settings?: unknown;
    categories?: unknown;
    updatedAt?: number;
  } | null;
  try {
    config = JSON.parse(raw);
  } catch {
    return c.json({ error: '非法 JSON' }, 400);
  }
  if (!config || !Array.isArray(config.sources) || !config.settings || !config.categories) {
    return c.json({ error: '配置缺少 sources、settings 或 categories' }, 400);
  }
  config.updatedAt = Date.now();
  const obj = await c.env.NEWS_R2.put('config/sources.json', JSON.stringify(config), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    ...(c.req.header('If-Match') ? { onlyIf: { etagMatches: c.req.header('If-Match')! } } : {}),
  });
  if (!obj) return c.json({ error: '配置已被其他操作更新，请重新加载设置后再保存' }, 409);
  c.header('ETag', obj.httpEtag);
  return c.json({ ok: true, updatedAt: config.updatedAt });
});

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDueTranslationJobs(env));
  },
};
