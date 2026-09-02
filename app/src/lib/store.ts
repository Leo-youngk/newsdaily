import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataApi } from './api';
import type { Item, LatestIndex } from '../types';

const SNAPSHOT_KEY = 'np-snapshot';
const DAYS_TO_LOAD = 3;

/** UTC+8 的日期键，与服务端 todayKey 一致 */
function dateKey(offsetDays: number): string {
  const d = new Date(Date.now() - offsetDays * 86400000);
  const cn = new Date(d.getTime() + 8 * 3600 * 1000);
  return cn.toISOString().slice(0, 10);
}

interface Snapshot {
  savedAt: number;
  items: Item[];
  index: LatestIndex | null;
}

function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(items: Item[], index: LatestIndex | null): void {
  try {
    const snap: Snapshot = { savedAt: Date.now(), items, index };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    /* 配额满时忽略 */
  }
}

export interface NewsState {
  items: Item[];
  byId: Map<string, Item>;
  index: LatestIndex | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  fromCache: boolean;
  refresh: () => Promise<void>;
}

export function useNews(): NewsState {
  // 惰性初始化：原来每次 render 都同步 JSON.parse 整包快照（几百 KB），
  // 打字搜索、切分类、滚动引发的重渲染全都要付这个成本
  const snapRef = useRef<Snapshot | null | undefined>(undefined);
  if (snapRef.current === undefined) snapRef.current = loadSnapshot();
  const snap = snapRef.current;

  const [items, setItems] = useState<Item[]>(() => snap?.items ?? []);
  const [index, setIndex] = useState<LatestIndex | null>(() => snap?.index ?? null);
  const [loading, setLoading] = useState<boolean>(!snap);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(snap?.savedAt ?? 0);
  const [fromCache, setFromCache] = useState<boolean>(!!snap);

  const lastRef = useRef(0);
  const refresh = useCallback(async () => {
    lastRef.current = Date.now();
    setLoading(true);
    setError(null);
    try {
      const idx = await dataApi.index().catch(() => null);
      // 优先用索引声明的日期分片，避免拉取不存在的日期产生 404
      const dates =
        idx?.dates && idx.dates.length
          ? idx.dates.slice(0, DAYS_TO_LOAD)
          : Array.from({ length: DAYS_TO_LOAD }, (_, i) => dateKey(i));
      const shards = await Promise.all(
        dates.map((d) => dataApi.items(d).catch(() => null)),
      );
      const map = new Map<string, Item>();
      for (const shard of shards) {
        if (!shard) continue;
        for (const it of shard.items) map.set(it.id, it);
      }
      const merged = [...map.values()].sort((a, b) => b.publishedAt - a.publishedAt);
      if (merged.length || idx) {
        setItems(merged);
        setIndex(idx);
        setLastUpdated(Date.now());
        setFromCache(false);
        saveSnapshot(merged, idx);
      } else if (snap) {
        setFromCache(true);
      } else {
        setError('暂无数据，请等待下一次抓取');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (snap) setFromCache(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // 只在页面可见时刷新：后台标签页里定时拉取纯属浪费
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRef.current > 5 * 60 * 1000) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(onVisible, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(t);
    };
  }, [refresh]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  return { items, byId, index, loading, error, lastUpdated, fromCache, refresh };
}
