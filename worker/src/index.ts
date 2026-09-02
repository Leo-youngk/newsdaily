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
  CORS_ORIGIN?: string;
}

const app = new Hono<{ Bindings: Env }>();

// 个人使用：默认放开跨域（Pages 与 Worker 不同源），写操作用 x-admin-token 鉴权
app.use(
  '/*',
  cors({
    origin: (origin) => origin ?? '*',
    allowHeaders: ['Content-Type', 'x-admin-token'],
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    maxAge: 86400,
  }),
);

function contentTypeFor(key: string): string {
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  if (key.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

app.get('/', (c) => c.json({ ok: true, service: 'news-pwa-worker' }));
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

/**
 * GET /data/* —— 从 R2 读取并透传，交给 Cloudflare CDN 缓存。
 * JSON: s-maxage=300；图片按内容寻址(md5)，可长缓存。
 */
app.get('/data/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/data\//, ''));
  if (!key) return c.notFound();
  const obj = await c.env.NEWS_R2.get(key);
  if (!obj) return c.notFound();
  const isImage = key.startsWith('img/');
  c.header(
    'Cache-Control',
    isImage
      ? 'public, max-age=31536000, s-maxage=31536000, immutable'
      : 'public, max-age=60, s-maxage=300',
  );
  c.header('Content-Type', contentTypeFor(key));
  c.header('ETag', obj.httpEtag);
  return c.body(obj.body);
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

/** POST /api/ai/summary  { id, text } —— 摘要，D1 缓存 key=sum:{id} */
app.post('/api/ai/summary', async (c) => {
  const { id, text } = await c.req.json<{ id: string; text: string }>();
  if (!id || !text) return c.json({ error: '缺少 id 或 text' }, 400);
  const key = `sum:${id}`;
  const hit = await cacheGet(c.env, key);
  if (hit) return c.json({ text: hit, cached: true });
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

/** POST /api/ai/translate  { id, text, field? } —— 翻译，key=tr:{id} / trt:{id} */
app.post('/api/ai/translate', async (c) => {
  const { id, text, field } = await c.req.json<{
    id: string;
    text: string;
    field?: 'title' | 'body';
  }>();
  if (!id || !text) return c.json({ error: '缺少 id 或 text' }, 400);
  const key = field === 'title' ? `trt:${id}` : `tr:${id}`;
  const hit = await cacheGet(c.env, key);
  if (hit) return c.json({ text: hit, cached: true });
  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: TRANSLATE_SYSTEM },
      { role: 'user', content: buildTranslateUserPrompt(text) },
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
  const row = await c.env.DB.prepare('SELECT json FROM user_config WHERE id = 1')
    .first<{ json: string }>();
  if (row?.json) {
    c.header('Cache-Control', 'public, max-age=60, s-maxage=120');
    return c.body(row.json, 200, { 'Content-Type': 'application/json; charset=utf-8' });
  }
  const obj = await c.env.NEWS_R2.get('config/sources.json');
  if (!obj) return c.json({ error: '尚无配置' }, 404);
  c.header('Cache-Control', 'public, max-age=60, s-maxage=120');
  return c.body(await obj.text(), 200, { 'Content-Type': 'application/json; charset=utf-8' });
});

/** PUT /api/config —— 需 x-admin-token；同时写 D1 与 R2，供下次 Actions 读取 */
app.put('/api/config', async (c) => {
  const token = c.req.header('x-admin-token');
  if (c.env.ADMIN_TOKEN && token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: '未授权' }, 401);
  }
  const raw = await c.req.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
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
  return c.json({ ok: true, updatedAt: now, size: raw.length, parsed: !!parsed });
});

export default app;
