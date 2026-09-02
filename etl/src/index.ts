import './proxy.js'; // 必须最先导入：设置全局 fetch 代理
import pLimit from 'p-limit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, assertCloudflareCreds } from './config.js';
import { parseFeed, type RawEntry } from './parse.js';
import { extractFromUrl } from './extract.js';
import { resolveTranscript } from './transcript.js';
import { cleanContentHtml, htmlToText } from './html.js';
import { processImage } from './images.js';
import { applyKeywords } from './filter.js';
import { Deduper } from './dedupe.js';
import {
  md5,
  truncate,
  domainMatches,
  normalizeUrl,
  todayKey,
  readingMinutes,
} from './util.js';
import * as store from './upload.js';
import type {
  AppConfig,
  Category,
  ContentSource,
  Item,
  ItemDetail,
  SourceConfig,
  LatestIndex,
  SourceHealth,
  TranscribeTask,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Built {
  item: Item;
  detail?: ItemDetail;
  image?: { key: string; buf: Buffer };
}

interface SourceResult {
  sourceId: string;
  ok: boolean;
  error?: string;
  built: Built[];
  /** 拿到全文的条数 / 总条数 */
  readable: number;
  total: number;
  /** 已入队等待转写的条数 */
  pending: number;
}

async function loadSeedConfig(): Promise<AppConfig> {
  const p = path.join(__dirname, '..', 'sources.seed.json');
  return JSON.parse(await readFile(p, 'utf8')) as AppConfig;
}

async function loadConfig(): Promise<AppConfig> {
  const seed = await loadSeedConfig();
  if (process.env.FORCE_SEED === '1') {
    console.log(`[config] FORCE_SEED=1，用种子清单覆盖 R2（${seed.sources.length} 源）`);
    await store.writeConfig({ ...seed, updatedAt: Date.now() });
    return seed;
  }
  const remote = await store.readConfig();
  // 种子清单版本更高时（schema 改过）强制以种子为准，避免旧结构污染管线
  if (remote && Array.isArray(remote.sources) && remote.sources.length) {
    if ((remote.version ?? 0) >= seed.version) {
      console.log(`[config] 使用 R2 config/sources.json（${remote.sources.length} 源）`);
      return remote;
    }
    console.log(
      `[config] R2 配置版本 ${remote.version ?? 0} < 种子 ${seed.version}，改用种子清单并回写`,
    );
  } else {
    console.log(`[config] R2 无配置，使用种子清单（${seed.sources.length} 源）`);
  }
  await store.writeConfig({ ...seed, updatedAt: Date.now() });
  return seed;
}

/** 从已抓回的页面 HTML 里顺手取 og:image —— 不额外发请求 */
function ogImageFrom(html: string): string | undefined {
  const pats = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (m?.[1]) {
      let u = m[1].trim();
      if (u.startsWith('//')) u = 'https:' + u;
      if (/^https?:\/\//i.test(u)) return u;
    }
  }
  return undefined;
}

/**
 * 按源的 readable 等级取正文。三条路都失败就只留摘要（contentLen=0）。
 * 返回值里的 pageHtml 供调用方复用取封面图，避免同一页面抓两遍。
 */
async function resolveContent(
  s: SourceConfig,
  entry: RawEntry,
  url: string,
): Promise<{ html: string; text: string; source: ContentSource; pageHtml?: string }> {
  const min = s.minChars;

  // 1) feed 自带全文
  if (s.readable === 'full') {
    const { html, text } = cleanContentHtml(entry.contentHtml, url);
    if (text.length >= min) return { html, text, source: 'feed' };
  }

  // 2) 播客逐字稿：<podcast:transcript> 标签 → 文稿页规则
  if (s.readable === 'transcript' || s.readable === 'transcribe') {
    const t = await resolveTranscript(url, entry.transcripts, s.transcript, min);
    if (t) return { html: t.html, text: t.text, source: t.source };
  }

  // 3) 没有任何现成文字稿的播客：入队等 whisper 转写，不在这里阻塞采集
  if (s.readable === 'transcribe') {
    if (entry.audioUrl) return { html: '', text: '', source: 'pending-transcript' };
    return { html: '', text: '', source: 'none' };
  }

  // 4) 兜底：抓原文页做正文提取（readable=extract 的主路径，也是前两条的降级）
  const ex = await extractFromUrl(url);
  if (ex && ex.text.length >= min) {
    return { html: ex.html, text: ex.text, source: 'extract', pageHtml: ex.pageHtml };
  }

  // 全都不够长：退回 feed 里那点内容，但标记为没拿到全文
  const fallback = cleanContentHtml(entry.contentHtml, url);
  return {
    html: fallback.html,
    text: fallback.text,
    source: 'none',
    pageHtml: ex?.pageHtml,
  };
}

async function buildItem(s: SourceConfig, entry: RawEntry): Promise<Built | null> {
  const url = normalizeUrl(entry.link);

  // 域名校验放在最前面：不通过就直接丢，别浪费后面的抓取与图片处理
  if (!domainMatches(url, s.expectedDomain)) return null;

  const id = md5(s.id + (entry.guid || url));
  const content = await resolveContent(s, entry, url);

  const summaryText = truncate(
    htmlToText(entry.summary || entry.contentHtml) || content.text,
    220,
  );

  const item: Item = {
    id,
    sourceId: s.id,
    sourceName: s.name,
    category: s.category,
    lang: s.lang,
    title: entry.title,
    summary: summaryText || undefined,
    url,
    publishedAt: entry.publishedAt,
    contentLen: content.text.length && content.source !== 'pending-transcript'
      ? content.text.length
      : 0,
    contentSource: content.source,
    readingMinutes:
      content.source === 'none' || content.source === 'pending-transcript'
        ? 0
        : readingMinutes(content.text, s.lang),
    audioUrl: entry.audioUrl,
    durationSec: entry.durationSec,
    tags: entry.categories.slice(0, 5),
  };

  // 封面图：只用已经在手上的候选（feed 里的图，或刚抓的页面里的 og:image），
  // 绝不为了图片额外发请求 —— 图片是加分项，不是必需品
  let image: { key: string; buf: Buffer } | undefined;
  if (config.images) {
    const cand =
      entry.imageCandidate ?? (content.pageHtml ? ogImageFrom(content.pageHtml) : undefined);
    if (cand) {
      const key = `img/${md5(cand)}.webp`;
      // 已经在 R2 里就别重下重编码了（原来每 2 小时把所有图重跑一遍）
      if (await store.imageExists(key)) {
        item.image = config.imgBase + key;
      } else {
        const processed = await processImage(cand);
        if (processed) {
          image = processed;
          item.image = config.imgBase + processed.key;
        }
      }
    }
  }

  const detail: ItemDetail | undefined =
    content.source === 'none' || content.source === 'pending-transcript'
      ? undefined
      : {
          id,
          title: entry.title,
          url,
          sourceId: s.id,
          sourceName: s.name,
          contentHtml: content.html,
          contentText: content.text,
          contentSource: content.source,
          extractedAt: Date.now(),
        };

  return { item, detail, image };
}

async function processSource(s: SourceConfig): Promise<SourceResult> {
  const base: SourceResult = {
    sourceId: s.id, ok: false, built: [], readable: 0, total: 0, pending: 0,
  };
  try {
    const entries = await parseFeed(s.url);
    const targets = entries.slice(0, Math.max(s.limit, 1));

    // 源内并发 3：正文/文稿抓取是这条管线里最慢的一步
    const lim = pLimit(3);
    const results = await Promise.all(
      targets.map((e) =>
        lim(async () => {
          try {
            return await buildItem(s, e);
          } catch {
            return null;
          }
        }),
      ),
    );

    const built = results.filter((b): b is Built => b !== null);
    const filtered = applyKeywords(
      built.map((b) => b.item),
      s.keywords ?? [],
    );
    const keep = new Set(filtered.map((i) => i.id));
    const passed = built.filter((b) => keep.has(b.item.id));

    // 可读率按"抓到的"算，是源的质量指标；真正入库的还要过 dropUnreadable。
    // 待转写的条目算"在途"，既不计入可读也不该被丢掉。
    const isPending = (b: Built) => b.item.contentSource === 'pending-transcript';
    base.total = passed.length;
    base.readable = passed.filter((b) => b.item.contentLen > 0).length;
    base.pending = passed.filter(isPending).length;
    base.built =
      s.dropUnreadable === false
        ? passed
        : passed.filter((b) => b.item.contentLen > 0 || isPending(b));
    base.ok = true;

    const rate = base.total ? Math.round((base.readable / base.total) * 100) : 0;
    const bySource = base.built.reduce<Record<string, number>>((acc, b) => {
      acc[b.item.contentSource] = (acc[b.item.contentSource] ?? 0) + 1;
      return acc;
    }, {});
    const dropped = base.total - base.built.length;
    console.log(
      `[ok] ${s.name}: 抓 ${base.total} 可读 ${base.readable} (${rate}%)` +
        `${base.pending ? ` 待转写 ${base.pending}` : ''}` +
        `${dropped ? ` 丢弃 ${dropped}` : ''} → 入库 ${base.built.length}  ${JSON.stringify(bySource)}`,
    );
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    console.warn(`[fail] ${s.name}: ${base.error}`);
  }
  return base;
}

/** 用保留期内的历史条目预热去重器（含今天，避免同日多轮跑出重复） */
async function seedDeduper(deduper: Deduper): Promise<void> {
  for (let i = 0; i <= config.dedupeWindowDays; i++) {
    const d = todayKey(new Date(Date.now() - i * 86400000));
    try {
      const items = await store.readItems(d);
      if (items.length) deduper.seed(items);
    } catch {
      /* ignore */
    }
  }
}

function buildIndex(
  items: Item[],
  order: Category[],
  dates: string[],
  readableRate: number,
): LatestIndex {
  const categories: Record<string, string[]> = {};
  const sorted = [...items].sort((a, b) => b.publishedAt - a.publishedAt);
  for (const it of sorted) (categories[it.category] ??= []).push(it.id);
  const ordered: Record<string, string[]> = {};
  for (const c of order) if (categories[c]) ordered[c] = categories[c];
  for (const c of Object.keys(categories)) if (!ordered[c]) ordered[c] = categories[c];
  return {
    generatedAt: Date.now(),
    categories: ordered,
    all: sorted.map((i) => i.id),
    itemCount: sorted.length,
    dates,
    readableRate,
  };
}

/**
 * 保留策略。
 * 关键修复：keep 集合必须覆盖保留期内的**所有**日期分片。
 * 原来只用当天的条目建 keep 集，导致每轮运行都把昨天及更早的
 * detail/ 与 img/ 全删掉 —— 前端要加载 3 天，第 2、3 天必然没图没正文。
 */
async function cleanup(retainedShards: string[], cutoffMs: number): Promise<void> {
  if (config.dryRun) return;

  const keepDetail = new Set<string>();
  const keepImg = new Set<string>();
  for (const date of retainedShards) {
    const items = await store.readItems(date).catch(() => [] as Item[]);
    for (const it of items) {
      if (it.contentLen > 0) keepDetail.add(it.id);
      if (it.image) keepImg.add(it.image.replace(config.imgBase, ''));
    }
  }
  console.log(
    `[cleanup] 保留 ${retainedShards.length} 个分片，引用 detail ${keepDetail.size} / img ${keepImg.size}`,
  );

  let removed = 0;
  for (const key of await store.listKeys('items/')) {
    const m = key.match(/items\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (m && Date.parse(m[1]) < cutoffMs) {
      await store.deleteKey(key);
      removed++;
    }
  }
  for (const k of await store.listKeys('detail/')) {
    const id = k.replace('detail/', '').replace('.json', '');
    if (!keepDetail.has(id)) {
      await store.deleteKey(k);
      removed++;
    }
  }
  for (const k of await store.listKeys('img/')) {
    if (!keepImg.has(k)) {
      await store.deleteKey(k);
      removed++;
    }
  }
  if (removed) console.log(`[cleanup] 删除过期对象 ${removed} 个`);
}

async function main(): Promise<void> {
  assertCloudflareCreds();
  const startedAt = Date.now();
  console.log(`[start] dryRun=${config.dryRun} bucket=${config.bucket} date=${todayKey()}`);

  const cfg = await loadConfig();
  let sources = cfg.sources.filter(
    (s) => s.enabled && cfg.categories[s.category] !== false,
  );

  const only = (process.env.ONLY_SOURCES ?? '').trim();
  if (only) {
    const ids = new Set(only.split(',').map((x) => x.trim()).filter(Boolean));
    sources = sources.filter((s) => ids.has(s.id));
  }

  const health = (await store.readHealth<{ sources: Record<string, SourceHealth> }>())
    ?.sources ?? {};
  const active = sources.filter((s) => (health[s.id]?.consecutive_fail ?? 0) < 5);
  console.log(
    `[plan] ${active.length} 个源：` +
      Object.entries(
        active.reduce<Record<string, number>>((a, s) => {
          a[s.category] = (a[s.category] ?? 0) + 1;
          return a;
        }, {}),
      )
        .map(([c, n]) => `${c}${n}`)
        .join(' '),
  );

  const limit = pLimit(config.concurrency);
  const results = await Promise.all(active.map((s) => limit(() => processSource(s))));

  // ---- 汇总与去重 ----
  const deduper = new Deduper();
  await seedDeduper(deduper);
  const allBuilt: Built[] = [];
  for (const r of results) if (r.ok) allBuilt.push(...r.built);

  const uniqueItems = deduper.dedupe(allBuilt.map((b) => b.item));
  const keepIds = new Set(uniqueItems.map((i) => i.id));
  const built = allBuilt.filter((b) => keepIds.has(b.item.id));

  const readableCount = built.filter((b) => b.item.contentLen > 0).length;
  const rate = built.length ? Math.round((readableCount / built.length) * 100) : 0;
  console.log(
    `[dedupe] ${allBuilt.length} → ${built.length} 条，可读 ${readableCount} (${rate}%)`,
  );

  // ---- 写入（整段包住：单次失败不能让整轮白跑）----
  const date = todayKey();
  try {
    const existing = await store.readItems(date);
    // 旧 schema 的残留条目（没有 contentSource）直接丢弃，
    // 否则会带着已废弃的分类和缺失字段混进新数据里
    const legacy = existing.filter((it) => !it.contentSource).length;
    if (legacy) console.log(`[migrate] 丢弃 ${legacy} 条旧 schema 残留`);
    const merged = new Map<string, Item>();
    for (const it of existing) if (it.contentSource) merged.set(it.id, it);
    for (const b of built) merged.set(b.item.id, b.item);
    const mergedItems = [...merged.values()].sort((a, b) => b.publishedAt - a.publishedAt);

    await store.writeItems(date, mergedItems);

    const shardKeys = await store.listKeys('items/');
    const dates = shardKeys.length
      ? shardKeys
          .map((k) => k.match(/items\/(\d{4}-\d{2}-\d{2})\.json$/)?.[1])
          .filter((d): d is string => !!d)
          .sort((a, b) => b.localeCompare(a))
      : [date];

    const mergedReadable = mergedItems.filter((i) => i.contentLen > 0).length;
    const mergedRate = mergedItems.length
      ? Math.round((mergedReadable / mergedItems.length) * 100)
      : 0;
    await store.writeIndex(
      buildIndex(mergedItems, cfg.settings.categoryOrder, dates, mergedRate),
    );

    // 详情与图片并发写
    const wlim = pLimit(config.concurrency);
    await Promise.all(
      built
        .filter((b) => b.detail)
        .map((b) => wlim(() => store.writeDetail(b.detail!))),
    );
    let imgUp = 0;
    await Promise.all(
      built
        .filter((b) => b.image)
        .map((b) =>
          wlim(async () => {
            const { skipped } = await store.putImage(b.image!.key, b.image!.buf, true);
            if (!skipped) imgUp++;
          }),
        ),
    );

    // 待转写入队：中文播客没有任何现成文字稿，交给 transcribe 工作流异步处理
    const queue = (await store.readQueue()) ?? { updatedAt: 0, tasks: [] as TranscribeTask[] };
    const known = new Set(queue.tasks.map((t) => t.id));
    // 已经转写完成的（detail 已存在）不要再入队
    const newTasks: TranscribeTask[] = [];
    for (const b of built) {
      const it = b.item;
      if (it.contentSource !== 'pending-transcript' || !it.audioUrl) continue;
      if (known.has(it.id)) continue;
      newTasks.push({
        id: it.id,
        sourceId: it.sourceId,
        sourceName: it.sourceName,
        title: it.title,
        url: it.url,
        audioUrl: it.audioUrl,
        lang: it.lang,
        date,
        durationSec: it.durationSec,
        enqueuedAt: Date.now(),
        attempts: 0,
      });
    }
    if (newTasks.length || queue.tasks.length) {
      await store.writeQueue({
        updatedAt: Date.now(),
        tasks: [...queue.tasks, ...newTasks],
      });
    }
    if (newTasks.length) {
      const mins = newTasks.reduce((a, t) => a + Math.ceil((t.durationSec ?? 3600) / 60), 0);
      console.log(
        `[queue] 新入队 ${newTasks.length} 条待转写（约 ${mins} 分钟音频），队列共 ${queue.tasks.length + newTasks.length} 条`,
      );
    }

    // 健康度
    const now = Date.now();
    for (const r of results) {
      const prev = health[r.sourceId] ?? {
        source_id: r.sourceId,
        consecutive_fail: 0,
        last_error: '',
        last_success: 0,
        last_readable_rate: 0,
      };
      health[r.sourceId] = r.ok
        ? {
            ...prev,
            consecutive_fail: 0,
            last_error: '',
            last_success: now,
            last_readable_rate: r.total ? r.readable / r.total : 0,
          }
        : {
            ...prev,
            consecutive_fail: (prev.consecutive_fail ?? 0) + 1,
            last_error: r.error ?? 'unknown',
          };
    }
    await store.writeHealth({ updatedAt: now, readableRate: mergedRate, sources: health });

    // 保留策略：keep 集覆盖全部保留分片
    const cutoff = now - config.retentionDays * 86400000;
    const retained = dates.filter((d) => Date.parse(d) >= cutoff);
    await cleanup(retained, cutoff);

    console.log(
      `[done] 当日 ${mergedItems.length} 条（可读 ${mergedRate}%），新增图 ${imgUp}，用时 ${(
        (Date.now() - startedAt) / 1000
      ).toFixed(1)}s`,
    );
  } catch (err) {
    console.error('[fatal] 写入阶段失败：', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
