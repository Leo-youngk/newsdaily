import './proxy.js'; // 必须最先导入：设置全局 fetch 代理
import pLimit from 'p-limit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, assertCloudflareCreds } from './config.js';
import { parseFeed, type RawEntry } from './parse.js';
import { unpackGoogleNewsUrl } from './gnews.js';
import { pickCoverFromEntry, fetchOgImage, processImage } from './images.js';
import { extractContent } from './extract.js';
import { applyKeywords } from './filter.js';
import { Deduper } from './dedupe.js';
import {
  md5,
  truncate,
  stripHtml,
  domainMatches,
  normalizeUrl,
  todayKey,
} from './util.js';
import * as store from './upload.js';
import type {
  AppConfig,
  Item,
  ItemDetail,
  SourceConfig,
  LatestIndex,
  SourceHealth,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface SourceResult {
  sourceId: string;
  ok: boolean;
  error?: string;
  items: Item[];
  details: ItemDetail[];
  images: Array<{ key: string; buf: Buffer }>;
  count: number;
}

async function loadSeedConfig(): Promise<AppConfig> {
  const p = path.join(__dirname, '..', 'sources.seed.json');
  const raw = await readFile(p, 'utf8');
  return JSON.parse(raw) as AppConfig;
}

async function loadConfig(): Promise<AppConfig> {
  // FORCE_SEED=1：用种子清单强制覆盖 R2 配置（更新源列表/开关时用）
  if (process.env.FORCE_SEED === '1') {
    const seed = await loadSeedConfig();
    console.log(`[config] FORCE_SEED=1，用种子清单覆盖 R2 配置（${seed.sources.length} 源）`);
    await store.writeConfig({ ...seed, updatedAt: Date.now() });
    return seed;
  }
  const remote = await store.readConfig();
  if (remote && Array.isArray(remote.sources) && remote.sources.length) {
    console.log(`[config] 使用 R2 config/sources.json（${remote.sources.length} 源）`);
    return remote;
  }
  const seed = await loadSeedConfig();
  console.log(`[config] R2 无配置，使用种子清单（${seed.sources.length} 源），并回写 R2`);
  await store.writeConfig({ ...seed, updatedAt: Date.now() });
  return seed;
}

function kindEnabled(cfg: AppConfig, s: SourceConfig): boolean {
  return cfg.contentTypes[s.kind] !== false;
}

async function buildItem(
  s: SourceConfig,
  entry: RawEntry,
  ogCap: { left: number },
): Promise<{ item: Item; image?: { key: string; buf: Buffer } }> {
  // Google News 链接解包
  const unpacked =
    s.type === 'gnews'
      ? await unpackGoogleNewsUrl(entry.link)
      : { url: entry.link, resolved: true };
  const url = normalizeUrl(unpacked.url || entry.link);

  const id = md5(s.id + (entry.guid || url));
  const summaryText = truncate(
    stripHtml(entry.summary || entry.contentHtml),
    200,
  );

  const item: Item = {
    id,
    sourceId: s.id,
    sourceName: s.name,
    kind: s.kind,
    category: s.category,
    title: entry.title,
    summary: summaryText || undefined,
    url,
    imageSource: 'none',
    publishedAt: entry.publishedAt,
    contentLen: 0,
    tags: entry.categories.slice(0, 5),
  };
  if (!unpacked.resolved) item.tags = [...item.tags, 'link-unresolved'];

  // 封面图五级回退
  const cover = pickCoverFromEntry(entry);
  let imgUrl = cover.url;
  let imageSource = cover.imageSource;
  if (!imgUrl && ogCap.left > 0) {
    ogCap.left--;
    const og = await fetchOgImage(url);
    if (og) {
      imgUrl = og;
      imageSource = 'og-image';
    }
  }

  let image: { key: string; buf: Buffer } | undefined;
  if (imgUrl) {
    const processed = await processImage(imgUrl);
    if (processed) {
      image = processed;
      item.image = config.imgBase + processed.key;
      item.imageSource = imageSource;
    } else {
      item.imageSource = 'none';
    }
  }

  return { item, image };
}

async function processSource(
  cfg: AppConfig,
  s: SourceConfig,
  ogCap: { left: number },
  extractCap: { left: number },
): Promise<SourceResult> {
  const base: SourceResult = {
    sourceId: s.id,
    ok: false,
    items: [],
    details: [],
    images: [],
    count: 0,
  };
  try {
    const entries = await parseFeed(s.url);
    const limited = entries.slice(0, Math.max(s.limit, 1) * 2); // 预留过滤空间
    const items: Item[] = [];
    const images: Array<{ key: string; buf: Buffer }> = [];
    const details: ItemDetail[] = [];

    for (const entry of limited) {
      const { item, image } = await buildItem(s, entry, ogCap);
      // 安全校验：链接域名一致性
      if (!domainMatches(item.url, s.expectedDomain)) {
        item.tags = [...item.tags, 'domain-mismatch'];
        continue; // 丢弃
      }
      items.push(item);
      if (image) images.push(image);
      if (items.length >= Math.max(s.limit, 1)) break;
    }

    // 关键词过滤（每源）
    const filtered = applyKeywords(items, s.keywords ?? []);

    // 正文提取：默认对所有源开启（可用 offlineReading:false 关闭），受全局提取预算限制
    // 提取成功的条目写入 detail/{id}.json，前端阅读页即可在应用内直接读全文，无需跳转
    if (config.extractContent && s.offlineReading !== false && extractCap.left > 0) {
      const budget = Math.min(extractCap.left, filtered.length);
      extractCap.left -= budget;
      const targets = filtered.slice(0, budget);
      const exLimit = pLimit(3);
      const tasks = targets.map((it) =>
        exLimit(async () => {
          const d = await extractContent(
            it.id,
            it.url,
            it.title,
            it.sourceId,
            it.sourceName,
          );
          if (d) {
            details.push(d);
            it.contentLen = d.contentText.length;
          }
        }),
      );
      await Promise.all(tasks);
    }

    base.ok = true;
    base.items = filtered;
    base.details = details;
    base.images = images;
    base.count = filtered.length;
    console.log(`[ok] ${s.name}: ${filtered.length} 条 / 图 ${images.length}`);
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    console.warn(`[fail] ${s.name}: ${base.error}`);
  }
  return base;
}

async function seedDeduper(deduper: Deduper): Promise<void> {
  const days: string[] = [];
  for (let i = 1; i <= config.dedupeWindowDays; i++) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(todayKey(d));
  }
  for (const d of days) {
    try {
      const items = await store.readItems(d);
      if (items.length) deduper.seed(items);
    } catch {
      /* ignore */
    }
  }
}

function buildIndex(items: Item[], order: string[], dates: string[]): LatestIndex {
  const categories: Record<string, string[]> = {};
  const sorted = [...items].sort((a, b) => b.publishedAt - a.publishedAt);
  for (const it of sorted) {
    (categories[it.category] ??= []).push(it.id);
  }
  // 按 categoryOrder 稳定排序分类键
  const orderedCats: Record<string, string[]> = {};
  for (const c of order) if (categories[c]) orderedCats[c] = categories[c];
  for (const c of Object.keys(categories)) if (!orderedCats[c]) orderedCats[c] = categories[c];
  return {
    generatedAt: Date.now(),
    categories: orderedCats,
    all: sorted.map((i) => i.id),
    itemCount: sorted.length,
    dates,
  };
}

async function loadHealth(): Promise<Record<string, SourceHealth>> {
  const h = await store.readHealth<{ sources: Record<string, SourceHealth> }>();
  return h?.sources ?? {};
}

async function cleanup(cutoffMs: number, keepKeys: Set<string>): Promise<void> {
  if (config.dryRun) return;
  let removed = 0;
  // items/{date}.json：按文件名日期删除过期分片
  const itemKeys = await store.listKeys('items/');
  for (const key of itemKeys) {
    const m = key.match(/items\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && Date.parse(m[1]) < cutoffMs) {
      await store.deleteKey(key);
      removed++;
    }
  }
  // detail/{id}.json：删除不再被任何保留条目引用的详情
  for (const k of await store.listKeys('detail/')) {
    const id = k.replace('detail/', '').replace('.json', '');
    if (!keepKeys.has(`detail:${id}`)) {
      await store.deleteKey(k);
      removed++;
    }
  }
  // img/{md5}.webp：删除未被引用的封面图
  for (const k of await store.listKeys('img/')) {
    if (!keepKeys.has(k)) {
      await store.deleteKey(k);
      removed++;
    }
  }
  if (removed) console.log(`[cleanup] 删除过期对象 ${removed} 个`);
}

async function main(): Promise<void> {
  assertCloudflareCreds();
  const startedAt = Date.now();
  console.log(
    `[start] dryRun=${config.dryRun} bucket=${config.bucket} date=${todayKey()}`,
  );

  const cfg = await loadConfig();
  let sources = cfg.sources.filter((s) => s.enabled && kindEnabled(cfg, s));
  // 测试用：ONLY_SOURCES=ithome,36kr 仅跑指定源
  const only = (process.env.ONLY_SOURCES ?? '').trim();
  if (only) {
    const ids = new Set(only.split(',').map((x) => x.trim()).filter(Boolean));
    sources = sources.filter((s) => ids.has(s.id));
  }

  // 连续失败 5 次的源自动跳过
  const health = await loadHealth();
  const activeSources = sources.filter((s) => (health[s.id]?.consecutive_fail ?? 0) < 5);

  const ogCap = { left: parseInt(process.env.OG_CAP ?? '80', 10) };
  // 全局正文提取预算（控制单次运行时长与请求数）
  const extractCap = { left: parseInt(process.env.EXTRACT_CAP ?? '250', 10) };
  const limit = pLimit(config.concurrency);
  const results = await Promise.all(
    activeSources.map((s) => limit(() => processSource(cfg, s, ogCap, extractCap))),
  );

  // 汇总去重
  const deduper = new Deduper();
  await seedDeduper(deduper);
  const allItems: Item[] = [];
  const allDetails: ItemDetail[] = [];
  const imageMap = new Map<string, Buffer>();
  for (const r of results) {
    if (!r.ok) continue;
    for (const img of r.images) if (!imageMap.has(img.key)) imageMap.set(img.key, img.buf);
    allDetails.push(...r.details);
    allItems.push(...r.items);
  }
  const unique = deduper.dedupe(allItems);
  unique.sort((a, b) => b.publishedAt - a.publishedAt);

  console.log(
    `[dedupe] 汇总 ${allItems.length} → 去重后 ${unique.length} 条，详情 ${allDetails.length}，图片 ${imageMap.size}`,
  );

  // 写日期分片（合并当日已有条目）
  const date = todayKey();
  const existingToday = await store.readItems(date);
  const mergedMap = new Map<string, Item>();
  for (const it of existingToday) mergedMap.set(it.id, it);
  for (const it of unique) mergedMap.set(it.id, it);
  const merged = [...mergedMap.values()].sort((a, b) => b.publishedAt - a.publishedAt);

  await store.writeItems(date, merged);
  // 可用日期分片（倒序）；DRY_RUN 下 listKeys 为空则回退为当日
  const shardKeys = await store.listKeys('items/');
  const dates = shardKeys.length
    ? shardKeys
        .map((k) => k.match(/items\/(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
        .filter((d): d is string => !!d)
        .sort((a, b) => b.localeCompare(a))
    : [date];
  await store.writeIndex(buildIndex(merged, cfg.settings.categoryOrder, dates));

  // 详情
  for (const d of allDetails) await store.writeDetail(d);

  // 图片上传（已存在则跳过）
  let imgUploaded = 0;
  let imgSkipped = 0;
  const imgLimit = pLimit(config.concurrency);
  await Promise.all(
    [...imageMap.entries()].map(([key, buf]) =>
      imgLimit(async () => {
        const { skipped } = await store.putImage(key, buf, true);
        skipped ? imgSkipped++ : imgUploaded++;
      }),
    ),
  );

  // 健康度更新
  const now = Date.now();
  for (const r of results) {
    const prev = health[r.sourceId] ?? {
      source_id: r.sourceId,
      consecutive_fail: 0,
      last_error: '',
      last_success: 0,
    };
    if (r.ok) {
      health[r.sourceId] = { ...prev, consecutive_fail: 0, last_error: '', last_success: now };
    } else {
      health[r.sourceId] = {
        ...prev,
        consecutive_fail: (prev.consecutive_fail ?? 0) + 1,
        last_error: r.error ?? 'unknown',
      };
    }
  }
  await store.writeHealth({ updatedAt: now, sources: health });

  // 保留策略
  const cutoff = now - config.retentionDays * 86400000;
  const keepImageKeys = new Set<string>();
  for (const it of merged) {
    if (it.image) {
      const key = it.image.replace(config.imgBase, '');
      keepImageKeys.add(key);
    }
    keepImageKeys.add(`detail:${it.id}`);
  }
  await cleanup(cutoff, keepImageKeys);

  console.log(
    `[done] 条目 ${merged.length}，新增图片 ${imgUploaded}，跳过 ${imgSkipped}，用时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
