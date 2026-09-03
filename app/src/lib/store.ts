import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataApi, type TitleIndex } from './api';
import type { Item, LatestIndex } from '../types';

const SNAPSHOT_KEY = 'np-snapshot';
interface Snapshot { savedAt: number; items: Item[]; index: LatestIndex | null }
function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const value = raw ? JSON.parse(raw) as Snapshot : null;
    return value && Array.isArray(value.items) ? value : null;
  } catch { return null; }
}
function saveSnapshot(items: Item[], index: LatestIndex): boolean {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: Date.now(), items, index })); return true; }
  catch (err) { console.warn('[news] 本机快照保存失败', err); return false; }
}
export interface NewsState {
  items: Item[]; byId: Map<string, Item>; index: LatestIndex | null; loading: boolean;
  enrich: (items: Item[]) => Item[];
  titleStatus: string | null;
  error: string | null; lastUpdated: number; fromCache: boolean; refresh: () => Promise<void>;
}
export function useNews(): NewsState {
  const initial = useRef<Snapshot | null | undefined>(undefined);
  if (initial.current === undefined) initial.current = loadSnapshot();
  const [items, setItems] = useState<Item[]>(() => initial.current?.items ?? []);
  const [index, setIndex] = useState<LatestIndex | null>(() => initial.current?.index ?? null);
  const [loading, setLoading] = useState(!initial.current);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(initial.current?.savedAt ?? 0);
  const [fromCache, setFromCache] = useState(!!initial.current);
  const [titleStatus, setTitleStatus] = useState<string | null>(null);
  const [titleMap, setTitleMap] = useState<TitleIndex['translations']>(() => Object.fromEntries(
    (initial.current?.items ?? []).filter((item) => item.titleZh).map((item) => [item.id, { original: item.title, text: item.titleZh! }]),
  ));
  const [authorMap, setAuthorMap] = useState<Record<string, string>>({});
  const metadata = useRef({ titles: titleMap, authors: authorMap });
  const enrich = useCallback((entries: Item[]) => entries.map((item) => enrichItem(item, titleMap, authorMap)), [titleMap, authorMap]);
  const lastRef = useRef(0);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastRef.current = Date.now();
    setLoading(true); setError(null);
    const enrichment = Promise.allSettled([dataApi.titles(), dataApi.authors()] as const);
    try {
      const idx = await dataApi.index();
      if (!Array.isArray(idx.dates)) throw new Error('索引格式错误');
      const dates = [...new Set(idx.dates)].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort((a, b) => b.localeCompare(a));
      const shards: { items: Item[] }[] = new Array(dates.length);
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(4, dates.length) }, async () => {
        while (cursor < dates.length) {
          const i = cursor++;
          const shard = await dataApi.items(dates[i]);
          if (!Array.isArray(shard.items)) throw new Error(`分片 ${dates[i]} 格式错误`);
          shards[i] = shard;
        }
      }));
      const [titles, authors] = await enrichment;
      const warnings: string[] = [];
      if (titles.status === 'fulfilled' && titles.value.translations && typeof titles.value.translations === 'object') {
        metadata.current.titles = titles.value.translations;
        setTitleMap(titles.value.translations);
        setTitleStatus(titles.value.pending > 0 ? `${titles.value.pending} 个英文标题正在后台翻译，暂显示原题` : null);
        if (titles.value.warning) warnings.push(titles.value.warning);
      } else {
        warnings.push('中文标题暂时无法更新，未缓存的标题显示原文');
      }
      if (authors.status === 'fulfilled') {
        metadata.current.authors = authors.value;
        setAuthorMap(authors.value);
      } else {
        warnings.push('作者目录暂时无法更新');
      }
      const map = new Map<string, Item>();
      // 新日期优先，同 ID 的旧版本不能覆盖新版本。
      for (const shard of shards) for (const item of shard.items) if (!map.has(item.id)) map.set(item.id, item);
      const merged = [...map.values()].map((item) => enrichItem(item, metadata.current.titles, metadata.current.authors)).sort((a, b) => b.publishedAt - a.publishedAt);
      setItems(merged); setIndex(idx); setLastUpdated(Date.now()); setFromCache(false);
      if (!saveSnapshot(merged, idx)) warnings.push('内容已更新，但本机空间不足，未保存离线快照');
      setError(warnings.length ? warnings.join('；') : null);
    } catch (err) {
      // 任一分片失败都保留完整旧快照，不能把错误解释成空数据。
      setError(`更新失败，保留已加载内容：${err instanceof Error ? err.message : String(err)}`);
      setFromCache(true);
    } finally { inFlight.current = false; setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRef.current > 5 * 60 * 1000) void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(onVisible, 5 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
  }, [refresh]);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  return { items, byId, index, loading, error, titleStatus, enrich, lastUpdated, fromCache, refresh };
}

function enrichItem(item: Item, titles: TitleIndex['translations'], authors: Record<string, string>): Item {
  const translated = titles[item.id];
  const titleZh = translated?.original === item.title && typeof translated.text === 'string' && translated.text.trim()
    ? translated.text : item.titleZh;
  const author = typeof authors[item.id] === 'string' ? authors[item.id] : item.author;
  return { ...item, titleZh, author };
}
