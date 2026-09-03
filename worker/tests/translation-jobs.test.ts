// 隔离测试：内存 R2、真实 SQLite SQL、模拟第三方模型；不会调用云端。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { createTranslationJob, runTranslationJob, getTranslationJob, runDueTranslationJobs } from '../src/translation-jobs.js';
import { callModel, callWorkersAiTranslate } from '../src/ai.js';
import { translateParagraphBatch } from '../src/translations.js';
import worker from '../src/index.js';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0002_translation_jobs.sql', import.meta.url), 'utf8'));
  const DB = { prepare(query: string) {
    return { bind(...args: any[]) {
      const stmt = sql.prepare(query);
      return { first: async () => stmt.get(...args) ?? null, all: async () => ({ results: stmt.all(...args) }), run: async () => stmt.run(...args) };
    } };
  } };
  const objects = new Map<string, string>();
  let failWrites = false;
  const NEWS_R2 = {
    async get(key: string) {
      const value = objects.get(key);
      return value === undefined ? null : { json: async () => JSON.parse(value), body: value, httpEtag: '"test-etag"' };
    },
    async put(key: string, value: string, options?: any) {
      if (failWrites && key.startsWith('translations/')) throw new Error('TEST storage outage');
      if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
      if (options?.onlyIf?.etagMatches && options.onlyIf.etagMatches !== '"test-etag"') return null;
      objects.set(key, value); return { httpEtag: '"test-etag"' };
    },
  };
  return { env: { DB, NEWS_R2, AI_MODEL: 'test-primary', AI_FALLBACK_MODEL: 'test-backup', AI_API_KEY: 'test-only-key' } as any, objects, sql, failWrites: () => { failWrites = true; } };
}
const success = (text: string, finish_reason = 'stop') => Response.json({ choices: [{ message: { content: text }, finish_reason }] });
const realFetch = globalThis.fetch;

test('缺段只交给备用模型，重开任务复用完整结果', async () => {
  const f = fixture(); const calls: any[] = [];
  globalThis.fetch = async (_url, init) => {
    const data = JSON.parse(String(init!.body)); calls.push(data);
    return success(data.model === 'test-primary' ? '[0] 第一段\n[2] 第三段' : '[0] 第二段');
  };
  try {
    const inputs = ['one', 'two', 'three'].map((text, i) => ({ key: `${i}.0`, text }));
    const job = await createTranslationJob(f.env, 'test-article', inputs);
    const done = await runTranslationJob(f.env, job.id);
    assert.equal(done?.state, 'complete');
    assert.equal(done?.results['1.0'].text, '第二段');
    assert.equal(calls.length, 2);
    assert.match(calls[1].messages[1].content, /\[0\] two/);
    assert.doesNotMatch(calls[1].messages[1].content, /one|three/);
    assert.equal((await createTranslationJob(f.env, 'test-article', inputs)).completed, 3);
    await runTranslationJob(f.env, job.id);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});

test('全部通道失败后，定时任务补全；成功段不再生成', async () => {
  const f = fixture(); let outage = true; const requested: string[] = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('googleapis')) return new Response('', { status: 503 });
    const data = JSON.parse(String(init!.body)); requested.push(data.messages[1].content);
    if (outage) return success(data.model === 'test-primary' ? '[0] 已成功' : '');
    return success('[0] 后续补全');
  };
  const dateNow = Date.now; let now = dateNow(); Date.now = () => now;
  try {
    const job = await createTranslationJob(f.env, 'retry', [{ key: '0.0', text: 'already good' }, { key: '3.0', text: 'please retry' }]);
    const pending = await runTranslationJob(f.env, job.id);
    assert.equal(pending?.completed, 1); assert.equal(pending?.state, 'pending');
    assert.ok(pending!.nextAttempt > now);
    outage = false; requested.length = 0; now += 61000;
    await runDueTranslationJobs(f.env);
    assert.equal((await getTranslationJob(f.env, job.id))?.state, 'complete');
    assert.equal(requested.length, 1); assert.doesNotMatch(requested[0], /already good/);
  } finally { Date.now = dateNow; globalThis.fetch = realFetch; f.sql.close(); }
});

test('两次长段失败后自动拆短，所有子段成功才完成', async () => {
  const f = fixture(); let recovered = false; let chunkLengths: number[] = [];
  globalThis.fetch = async (url, init) => {
    if (!recovered) return new Response('', { status: 503 });
    const data = JSON.parse(String(init!.body));
    const lines = data.messages[1].content.split('\n').filter((s: string) => /^\[\d+\]/.test(s));
    chunkLengths = lines.map((s: string) => s.replace(/^\[\d+\] /, '').length);
    return success(lines.map((_s: string, i: number) => `[${i}] 短段译文${i}`).join('\n'));
  };
  const dateNow = Date.now; let now = dateNow(); Date.now = () => now;
  try {
    const job = await createTranslationJob(f.env, 'long', [{ key: '0.0', text: 'Long sentence. '.repeat(200) }]);
    assert.equal((await runTranslationJob(f.env, job.id))?.state, 'pending');
    now += 61000;
    assert.equal((await runTranslationJob(f.env, job.id))?.state, 'pending');
    now += 121000; recovered = true;
    const done = await runTranslationJob(f.env, job.id);
    assert.equal(done?.state, 'complete'); assert.ok(chunkLengths.length > 1);
    assert.ok(chunkLengths.every((n) => n <= 800));
  } finally { Date.now = dateNow; globalThis.fetch = realFetch; f.sql.close(); }
});

test('并发前台与后台请求只会领取一次任务', async () => {
  const f = fixture(); let release!: () => void; let calls = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  globalThis.fetch = async () => { calls++; await gate; return success('[0] 已翻译'); };
  try {
    const job = await createTranslationJob(f.env, 'concurrent', [{ key: '0.0', text: 'test' }]);
    const first = runTranslationJob(f.env, job.id);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await runTranslationJob(f.env, job.id);
    assert.equal(second?.busy, true); release(); await first; assert.equal(calls, 1);
  } finally { release(); globalThis.fetch = realFetch; f.sql.close(); }
});

test('段落缓存写失败仍把完整译文保存在任务中', async () => {
  const f = fixture(); f.failWrites(); globalThis.fetch = async () => success('[0] 保存到任务正文');
  try {
    const job = await createTranslationJob(f.env, 'write-fail', [{ key: '0.0', text: 'test' }]);
    await runTranslationJob(f.env, job.id);
    const saved = await getTranslationJob(f.env, job.id);
    assert.equal(saved?.state, 'complete'); assert.equal(saved?.results['0.0'].text, '保存到任务正文');
    assert.ok(saved!.warnings.length);
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});

test('拒绝截断输出，Workers AI 超时信号实际传入绑定', async () => {
  globalThis.fetch = async () => success('[0] 不完整', 'length');
  try {
    await assert.rejects(callModel({ AI_API_KEY: 'test' }, 'test', []), /未完整结束/);
    const AI = { run: async (_model: string, _body: unknown, options: any) => {
      assert.ok(options.signal);
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('TEST aborted'))));
    } } as any;
    await assert.rejects(callWorkersAiTranslate({ AI }, 'test', 20), /TEST aborted/);
  } finally { globalThis.fetch = realFetch; }
});

test('主备失败时独立 Workers AI 补全，缓存失败不会重复生成', async () => {
  const f = fixture(); let cfCalls = 0;
  globalThis.fetch = async () => new Response('', { status: 503 });
  f.env.AI = { run: async () => { cfCalls++; return { translated_text: '独立通道译文' }; } };
  try {
    const inputs = [{ key: '9.0', text: 'fallback test' }];
    assert.equal((await translateParagraphBatch(f.env, inputs)).results[0].text, '独立通道译文');
    assert.equal((await translateParagraphBatch(f.env, inputs)).results[0].cached, true);
    assert.equal(cfCalls, 1);
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});

test('无令牌可创建、读取、运行翻译任务和保存配置，仍校验输入及 ETag', async () => {
  const f = fixture(); const ctx = { waitUntil() {} } as any;
  const req = (path: string, body: any) => new Request(`https://test.local${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    globalThis.fetch = async () => success('[0] 免令牌译文');
    const created = await worker.fetch(req('/api/ai/jobs', { articleId: 'test', paragraphs: [{ key: '0', text: 'hello' }] }), f.env, ctx);
    assert.equal(created.status, 200);
    const job = await created.json() as { id: string };
    assert.equal((await worker.fetch(new Request(`https://test.local/api/ai/jobs/${job.id}`), f.env, ctx)).status, 200);
    const completed = await worker.fetch(req(`/api/ai/jobs/${job.id}/run`, {}), f.env, ctx);
    assert.equal(completed.status, 200);
    assert.equal((await completed.json() as { state: string }).state, 'complete');
    for (const path of ['/api/ai/summary', '/api/ai/translate', '/api/ai/jobs']) {
      assert.equal((await worker.fetch(req(path, {}), f.env, ctx)).status, 400);
    }
    assert.equal((await worker.fetch(req('/api/ai/jobs', { articleId: 'test', paragraphs: [{ key: '0', text: 'a' }, { key: '0', text: 'b' }] }), f.env, ctx)).status, 400);
    f.objects.set('config/sources.json', JSON.stringify({ sources: [], settings: {}, categories: {} }));
    const res = await worker.fetch(new Request('https://test.local/api/config'), f.env, ctx);
    assert.equal(res.headers.get('etag'), '"test-etag"'); assert.equal(res.status, 200);
    const stale = new Request('https://test.local/api/config', { method: 'PUT', headers: { 'If-Match': '"old"' }, body: JSON.stringify({ sources: [], settings: {}, categories: {} }) });
    assert.equal((await worker.fetch(stale, f.env, ctx)).status, 409);
    const config = { sources: [], settings: { density: 'compact' }, categories: {} };
    const saved = await worker.fetch(new Request('https://test.local/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': '"test-etag"' }, body: JSON.stringify(config) }), f.env, ctx);
    assert.equal(saved.status, 200);
    assert.equal(JSON.parse(f.objects.get('config/sources.json')!).settings.density, 'compact');
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});
