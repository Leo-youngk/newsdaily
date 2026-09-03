// 内存 R2、真实 SQLite SQL、明确模拟的外部翻译响应。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { getTitleTranslations, loadTitleCatalog, runTitleTranslations } from '../src/title-translations.js';
import worker from '../src/index.js';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0003_title_translations.sql', import.meta.url), 'utf8'));
  const objects = new Map<string, string>();
  const DB = { prepare(query: string) { return { bind(...args: any[]) {
    const stmt = sql.prepare(query);
    return { all: async () => ({ results: stmt.all(...args) }), run: async () => stmt.run(...args) };
  } }; } };
  const NEWS_R2 = { async get(key: string) {
    const value = objects.get(key); return value === undefined ? null : { json: async () => JSON.parse(value) };
  } };
  const put = (key: string, value: unknown) => objects.set(key, JSON.stringify(value));
  put('index/latest.json', { dates: ['2026-09-03'] });
  const items = (list: unknown[]) => put('items/2026-09-03.json', { items: list });
  return { env: { DB, NEWS_R2, AI_API_KEY: 'test-only', AI_MODEL: 'test-primary', AI_FALLBACK_MODEL: 'test-backup' } as any, sql, objects, put, items };
}
const realFetch = globalThis.fetch;
const response = (text: string) => Response.json({ choices: [{ message: { content: text }, finish_reason: 'stop' }] });

test('全部日期、内容缓存、同 id 最新标题、已有中文标题和原文保留', async () => {
  const f = fixture(); let calls = 0;
  f.put('index/latest.json', { dates: ['2026-08-30', '2026-09-01', '2026-09-02', '2026-09-03', '../bad', '2026-02-30'] });
  f.put('items/2026-08-30.json', { items: [{ id: 'old', title: 'Old archive episode' }, { id: 'updated', title: 'Obsolete title' }] });
  f.put('items/2026-09-01.json', { items: [] }); f.put('items/2026-09-02.json', { items: [] });
  f.items([{ id: 'updated', title: 'New episode' }, { id: 'duplicate', title: 'New episode' },
    { id: 'chinese', title: '中文内容' }, { id: 'existing', title: 'Already translated', titleZh: '已有译文' }]);
  globalThis.fetch = async (_url, init) => {
    calls++;
    const prompt = JSON.parse(String(init!.body)).messages[1].content;
    assert.doesNotMatch(prompt, /Obsolete|Already translated|中文内容/);
    return response('[0] 最新节目\n[1] 历史节目');
  };
  try {
    const before = new Map(f.objects);
    const result = await runTitleTranslations(f.env);
    assert.equal(result.total, 4); assert.equal(result.pending, 0); assert.equal(result.completed, 2);
    assert.equal(result.translations.old.text, '历史节目');
    assert.equal(result.translations.updated.original, 'New episode');
    assert.equal(result.translations.duplicate.text, result.translations.updated.text);
    assert.equal(result.translations.existing.text, '已有译文');
    assert.match(result.warning!, /无效日期/);
    assert.equal((await runTitleTranslations(f.env)).processed, 0); assert.equal(calls, 1);
    assert.deepEqual(f.objects, before);
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});

test('标题内容变化后不会复用旧译文；读接口不调用 AI 或写 D1', async () => {
  const f = fixture(); let calls = 0;
  f.items([{ id: 'a', title: 'Old title' }]);
  globalThis.fetch = async () => { calls++; return response('[0] 中文标题'); };
  try {
    await runTitleTranslations(f.env);
    f.items([{ id: 'a', title: 'New title' }]);
    const view = await getTitleTranslations(f.env);
    assert.equal(view.pending, 1); assert.deepEqual(Object.keys(view.translations), []);
    assert.equal(calls, 1);
    assert.equal((f.sql.prepare('SELECT count(*) AS n FROM title_translations').get() as any).n, 1);
    await runTitleTranslations(f.env); assert.equal(calls, 2);
    assert.equal((await getTitleTranslations(f.env)).translations.a.original, 'New title');
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});

test('拒绝原样英文与错误输出，失败自动续跑且成功不重算', async () => {
  const f = fixture(); let recovered = false; const prompts: string[] = [];
  f.items([{ id: 'done', title: 'Good title' }, { id: 'retry', title: 'Retry title' }]);
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('googleapis')) return Response.json([[['Retry title']]]);
    const payload = JSON.parse(String(init!.body)); prompts.push(payload.messages[1].content);
    return response(recovered ? '[0] 后续完成' : payload.model === 'test-primary' ? '[0] 已完成\n[1] Retry title' : '[0] 抱歉，无法翻译');
  };
  const realNow = Date.now; let now = realNow(); Date.now = () => now;
  try {
    const initial = await runTitleTranslations(f.env);
    assert.equal(initial.pending, 1); assert.equal(initial.completed, 1);
    assert.match(initial.warning!, /自动重试/);
    assert.equal((await runTitleTranslations(f.env)).processed, 0);
    now += 61000; recovered = true; prompts.length = 0;
    assert.equal((await runTitleTranslations(f.env)).pending, 0);
    assert.equal(prompts.length, 1); assert.doesNotMatch(prompts[0], /Good title/);
  } finally { Date.now = realNow; globalThis.fetch = realFetch; f.sql.close(); }
});

test('并发扫描由 D1 原子领取，40 条上限可续跑', async () => {
  const f = fixture(); let release!: () => void; let calls = 0;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  f.items(Array.from({ length: 43 }, (_, i) => ({ id: String(i), title: `Episode ${i}` })));
  globalThis.fetch = async (_url, init) => {
    calls++; await gate;
    const prompt = JSON.parse(String(init!.body)).messages[1].content;
    const count = prompt.split('\n').filter((line: string) => /^\[\d+\]/.test(line)).length;
    return response(Array.from({ length: count }, (_, i) => `[${i}] 节目${i}`).join('\n'));
  };
  try {
    const snapshot = await loadTitleCatalog(f.env);
    const a = runTitleTranslations(f.env, snapshot);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const b = runTitleTranslations(f.env, snapshot);
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    const values = await Promise.all([a, b]);
    assert.equal(values.reduce((sum, v) => sum + v.completed, 0), 43);
    assert.equal(calls, 2);
    assert.equal((await getTitleTranslations(f.env)).pending, 0);
  } finally { release(); globalThis.fetch = realFetch; f.sql.close(); }
});

test('无令牌读取允许跨域，读取失败与缺失分片明确报告', async () => {
  const f = fixture(); f.items([{ id: 'a', title: 'Read only' }]);
  globalThis.fetch = async () => { throw new Error('只读接口不得发起网络调用'); };
  const context = { waitUntil() {} } as any;
  try {
    const res = await worker.fetch(new Request('https://test.local/api/titles', { headers: { Origin: 'https://example.org' } }), f.env, context);
    assert.equal(res.status, 200); assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal((await res.json() as any).pending, 1);
    assert.equal((f.sql.prepare('SELECT count(*) AS n FROM title_translations').get() as any).n, 0);
    f.put('index/latest.json', { dates: ['2026-09-03', '2026-09-02'] });
    assert.match((await getTitleTranslations(f.env)).warning!, /无法读取/);
    f.objects.delete('index/latest.json');
    assert.equal((await worker.fetch(new Request('https://test.local/api/titles'), f.env, context)).status, 503);
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});

test('主备失败后 Workers AI 与 Google 独立补译并持久化', async () => {
  const f = fixture(); let cfCalls = 0; let googleCalls = 0;
  f.items([{ id: 'a', title: 'Independent fallback' }, { id: 'b', title: 'Last fallback' }]);
  f.env.AI = { run: async (_model: string, input: any) => { cfCalls++;
    return { translated_text: input.text === 'Independent fallback' ? '独立备用译文' : 'Last fallback' };
  } };
  globalThis.fetch = async (url) => {
    if (String(url).includes('googleapis')) { googleCalls++; return Response.json([[['最后备用译文']]]); }
    return new Response('', { status: 503 });
  };
  try {
    const result = await runTitleTranslations(f.env);
    assert.equal(result.pending, 0); assert.equal(cfCalls, 2); assert.equal(googleCalls, 1);
    assert.equal((await runTitleTranslations(f.env)).processed, 0);
    assert.equal(cfCalls, 2); assert.equal(googleCalls, 1);
  } finally { globalThis.fetch = realFetch; f.sql.close(); }
});
