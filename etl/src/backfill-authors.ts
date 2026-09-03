import './proxy.js';
import pLimit from 'p-limit';
import { parseFeed } from './parse.js';
import { mergeAuthors, type AuthorIndex } from './authors.js';
import { md5, normalizeUrl } from './util.js';
import { assertCloudflareCreds } from './config.js';
import * as store from './upload.js';
import type { Item } from './types.js';

/** 从当前 RSS 中匹配已采集条目的真实署名，不重抓正文、不重写文章分片。 */
async function main() {
  assertCloudflareCreds();
  const [index, config, previous] = await Promise.all([
    store.readIndex(), store.readConfig(), store.getJson<AuthorIndex>('catalog/authors.json'),
  ]);
  if (!index || !config) throw new Error('缺少已发布索引或来源配置');
  const limit = pLimit(4);
  const dates = [...new Set(index.dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().reverse();
  const shards = await Promise.all(dates.map((date) => limit(() => store.readItems(date, true))));
  const items = new Map<string, Item>();
  for (const shard of shards) for (const item of shard) if (!items.has(item.id)) items.set(item.id, item);
  const updates: Pick<Item, 'id' | 'author'>[] = [...items.values()].filter((item) => item.author);
  const sources = config.sources.filter((source) => [...items.values()].some((item) => item.sourceId === source.id));
  let failed = 0;
  await Promise.all(sources.map((source) => limit(async () => {
    try {
      const entries = await parseFeed(source.url);
      const sourceItems = [...items.values()].filter((item) => item.sourceId === source.id);
      const byUrl = new Map(sourceItems.map((item) => [normalizeUrl(item.url), item]));
      let matched = 0;
      for (const entry of entries) {
        if (!entry.author) continue;
        const item = items.get(md5(source.id + (entry.guid || normalizeUrl(entry.link)))) ?? byUrl.get(normalizeUrl(entry.link));
        if (!item || item.sourceId !== source.id) continue;
        updates.push({ id: item.id, author: entry.author });
        matched++;
      }
      console.log(`[authors] ${source.name}: ${matched} 条真实署名`);
    } catch (err) {
      failed++;
      console.warn(`[authors] ${source.name} 暂无法读取: ${err instanceof Error ? err.message : String(err)}`);
    }
  })));
  const result = mergeAuthors(previous, updates);
  await store.putJson('catalog/authors.json', result);
  console.log(JSON.stringify({ items: items.size, authors: Object.keys(result.authors).filter((id) => items.has(id)).length, sources: sources.length, failed }));
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
