// 隔离测试：RSS 与条目均为明确测试夹具，不请求真实 feed 或模型。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanAuthor, mergeAuthors } from '../src/authors.js';
import { parseFeedXml } from '../src/parse.js';
import { buildDirectory } from '../../app/src/lib/directory.js';
import { searchFilter } from '../../app/src/lib/filter.js';
import { retainedDates } from '../src/retention.js';

test('目录索引只列出清理后仍保留的日期，跨日边界不会引用已删除分片', () => {
  const keys = ['items/2026-09-04.json', 'items/2026-09-03.json', 'items/2026-08-04.json', 'items/2026-08-05.json', 'items/2026-09-04.json', 'items/invalid.json'];
  assert.deepEqual(retainedDates(keys, Date.parse('2026-08-05T00:00:00Z')), ['2026-09-04', '2026-09-03', '2026-08-05']);
});

test('解析 RSS 与 Atom 真实署名，缺失署名不猜测', async () => {
  const rss = await parseFeedXml('<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Test</title><link>https://example.test</link><description>Test</description><item><title>One</title><link>https://example.test/1</link><dc:creator>Jane Doe</dc:creator></item><item><title>Two</title><link>https://example.test/2</link></item></channel></rss>');
  assert.equal(rss[0].author, 'Jane Doe'); assert.equal(rss[1].author, undefined);
  const atom = await parseFeedXml('<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title><entry><title>One</title><id>one</id><link href="https://example.test/1"/><author><name>John Smith</name></author></entry></feed>');
  assert.equal(atom[0].author, 'John Smith');
  assert.equal(cleanAuthor('test@example.test (Jane Doe)'), 'Jane Doe');
  assert.equal(cleanAuthor('test@example.test'), undefined);
});

test('署名补全保留旧记录，不以缺失署名覆盖已有作者', () => {
  const previous = { updatedAt: 1, authors: { a: 'Jane', b: 'John' } };
  assert.deepEqual(mergeAuthors(previous, [{ id: 'a' }, { id: 'c', author: 'Mary' }]).authors, { a: 'Jane', b: 'John', c: 'Mary' });
});

test('同节目合并且按时间排列，真实作者可跨来源归类，中文可搜索', () => {
  const base = { sourceId: 'show-a', sourceName: 'Test Show', title: 'English title', titleZh: '中文测试标题', author: 'Jane Doe', audioUrl: 'https://example.test/audio', publishedAt: 1 };
  const items = [{ ...base, id: 'a' }, { ...base, id: 'b', publishedAt: 3 }, { ...base, id: 'c', sourceId: 'column', sourceName: 'Column', audioUrl: undefined, author: 'jane doe', publishedAt: 2 }, { ...base, id: 'd', author: undefined, sourceId: 'other', sourceName: 'Other' }] as any;
  const sources = buildDirectory(items, 'source');
  assert.equal(sources.length, 3);
  assert.deepEqual(sources.find((group) => group.id === 'show-a')!.items.map((item) => item.id), ['b', 'a']);
  assert.equal(sources.find((group) => group.id === 'show-a')!.kind, '节目');
  const authors = buildDirectory(items, 'author');
  assert.equal(authors.length, 1); assert.equal(authors[0].items.length, 3);
  assert.equal(searchFilter(items, '中文测试').length, 4);
  assert.equal(searchFilter(items, 'Jane').length, 3);
});
