import { useCallback, useEffect, useState } from 'react';
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
  const snap = loadSnapshot();
  const [items, setItems] = useState<Item[]>(snap?.items ?? []);
  const [index, setIndex] = useState<LatestIndex | null>(snap?.index ?? null);
  const [loading, setLoading] = useState<boolean>(!snap);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(snap?.savedAt ?? 0);
  const [fromCache, setFromCache] = useState<boolean>(!!snap);

  const refresh = useCallback(async () => {
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
    // 每 5 分钟静默刷新一次
    const t = setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [refresh]);

  const byId = new Map(items.map((i) => [i.id, i]));
  return { items, byId, index, loading, error, lastUpdated, fromCache, refresh };
}
