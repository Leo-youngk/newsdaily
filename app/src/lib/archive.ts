import { del, get, getMany, set, update } from 'idb-keyval';
import type { Item, ItemDetail } from '../types';
import { dataApi } from './api';

export interface SavedArticle { item: Item; detail?: ItemDetail }
const key = (id: string) => `article:${id}`;
export async function savedArticles(ids: string[]): Promise<SavedArticle[]> {
  return (await getMany<SavedArticle | undefined>(ids.map(key))).filter((r): r is SavedArticle => !!r?.item);
}
export async function saveArticle(item: Item): Promise<void> {
  const existing = await get<SavedArticle>(key(item.id));
  const detail = existing?.detail ?? (item.contentLen > 0 ? await dataApi.detail(item.id) : undefined);
  await set(key(item.id), { item, detail });
}
export const removeArticle = (id: string) => del(key(id));

/** 收藏正文不依赖服务端保留期，也不受 SW 的 LRU 淘汰影响。 */
export async function readingDetail(id: string): Promise<ItemDetail> {
  try {
    const saved = await get<SavedArticle>(key(id));
    if (saved?.detail) return saved.detail;
  } catch (err) { console.warn('[archive] 本机正文读取失败，尝试网络', err); }
  const detail = await dataApi.detail(id);
  try {
    await update<SavedArticle | undefined>(key(id), (saved) => saved ? { ...saved, detail } : saved);
  } catch (err) { console.warn('[archive] 正文未保存到本机', err); }
  return detail;
}

export async function restoreSaved(ids: string[], recent: Item[], dates: string[]): Promise<SavedArticle[]> {
  const records = new Map((await savedArticles(ids)).map((r) => [r.item.id, r]));
  const needed = new Set(ids.filter((id) => !records.has(id)));
  const known = new Map(recent.filter((i) => needed.has(i.id)).map((i) => [i.id, i]));
  for (const date of dates) {
    if ([...needed].every((id) => known.has(id))) break;
    const shard = await dataApi.items(date);
    for (const item of shard.items) if (needed.has(item.id) && !known.has(item.id)) known.set(item.id, item);
  }
  for (const item of known.values()) {
    await saveArticle(item);
    records.set(item.id, (await get<SavedArticle>(key(item.id)))!);
  }
  return [...records.values()];
}
