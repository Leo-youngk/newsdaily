import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataApi } from './api';
import type { Item, LatestIndex } from '../types';

const SNAPSHOT_KEY = 'np-snapshot';
const DAYS_TO_LOAD = 3;
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
  const lastRef = useRef(0);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    lastRef.current = Date.now();
    setLoading(true); setError(null);
    try {
      const idx = await dataApi.index();
      if (!Array.isArray(idx.dates)) throw new Error('索引格式错误');
      const dates = [...new Set(idx.dates)].sort((a, b) => b.localeCompare(a)).slice(0, DAYS_TO_LOAD);
      const shards = await Promise.all(dates.map(async (d) => {
        const shard = await dataApi.items(d);
        if (!Array.isArray(shard.items)) throw new Error(`分片 ${d} 格式错误`);
        return shard;
      }));
      const map = new Map<string, Item>();
      // 新日期优先，同 ID 的旧版本不能覆盖新版本。
      for (const shard of shards) for (const item of shard.items) if (!map.has(item.id)) map.set(item.id, item);
      const merged = [...map.values()].sort((a, b) => b.publishedAt - a.publishedAt);
      setItems(merged); setIndex(idx); setLastUpdated(Date.now()); setFromCache(false);
      if (!saveSnapshot(merged, idx)) setError('内容已更新，但本机空间不足，未保存离线快照');
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
  return { items, byId, index, loading, error, lastUpdated, fromCache, refresh };
}
