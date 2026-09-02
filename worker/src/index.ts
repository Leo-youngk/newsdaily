import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { chat, type AiEnv, type ChatMessage } from './ai.js';
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

app.use('/*', async (c, next) => {
  const allow = (c.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return cors({
    // 不再反射任意 Origin：此前任何网站都能从浏览器直接调用本 Worker
    origin: (origin) => {
      if (!origin) return undefined;
      if (allow.length === 0) return undefined;
      if (allow.includes('*') || allow.includes(origin)) return origin;
      return undefined;
    },
    allowHeaders: ['Content-Type', 'x-admin-token'],
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
 * Worker 自己返回的响应默认不进 Cloudflare 边缘缓存（实测响应无 CF-Cache-Status），
 * 所以这里显式用 Cache API，并支持 If-None-Match 走 304。
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
  // 条件请求直接问 R2 要 304，省掉整个对象的读取与传输
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

  // 命中 onlyIf 时 R2 只回元数据、没有 body
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

/** 从 R2 取这条的正文，客户端不再需要把整篇文章传上来 */
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
 * 正文由 Worker 自己从 R2 读，不接受客户端传入 —— 否则任何人都能用真实 id
 * 配任意文本污染 D1 缓存，而且逐字稿要传十几万字符上来也不现实。
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
    return c.json({ text: r.text, model: r.model, cached: false });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

/**
 * POST /api/ai/translate  { id, field, text? }
 * field=title 时才接受客户端传 text（标题很短，且不进正文缓存空间）。
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
    const messages: ChatMessage[] = [
      { role: 'system', content: TRANSLATE_SYSTEM },
      { role: 'user', content: buildTranslateUserPrompt(source) },
    ];
    const r = await chat(c.env, messages);
    await cachePut(c.env, key, 'translate', r.model, r.text);
    return c.json({ text: r.text, model: r.model, cached: false });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

/** GET /api/config —— 优先读 D1，回退 R2 */
app.get('/api/config', async (c) => {
  const row = await c.env.DB.prepare('SELECT json FROM user_config WHERE id = 1').first<{
    json: string;
  }>();
  const body =
    row?.json ?? (await c.env.NEWS_R2.get('config/sources.json').then((o) => o?.text()));
  if (!body) return c.json({ error: '尚无配置' }, 404);
  return c.body(body, 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=120',
  });
});

/** PUT /api/config —— 需 x-admin-token；同时写 D1 与 R2，供下次 Actions 读取 */
app.put('/api/config', async (c) => {
  const auth = requireToken(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  const raw = await c.req.text();
  try {
    JSON.parse(raw);
  } catch {
    return c.json({ error: '非法 JSON' }, 400);
  }
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO user_config (id, json, updated_at) VALUES (1, ?1, ?2)
     ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
  )
    .bind(raw, now)
    .run();
  await c.env.NEWS_R2.put('config/sources.json', raw, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
  return c.json({ ok: true, updatedAt: now, size: raw.length });
});

export default app;
