// 关键词 DSL 的客户端实现（与服务端 filter.ts 同规则），用于设置页实时预览

import type { Item } from '../types';

export interface ParsedFilter {
  any: string[];
  must: string[];
  exclude: string[];
  limit?: number;
}

export function parseKeywords(keywords: string[] = []): ParsedFilter {
  const f: ParsedFilter = { any: [], must: [], exclude: [] };
  for (const raw of keywords) {
    const kw = raw.trim();
    if (!kw) continue;
    if (kw.startsWith('@')) {
      const n = parseInt(kw.slice(1), 10);
      if (!Number.isNaN(n) && n > 0) f.limit = n;
    } else if (kw.startsWith('+')) {
      const w = kw.slice(1).trim();
      if (w) f.must.push(w.toLowerCase());
    } else if (kw.startsWith('!')) {
      const w = kw.slice(1).trim();
      if (w) f.exclude.push(w.toLowerCase());
    } else {
      f.any.push(kw.toLowerCase());
    }
  }
  return f;
}

export function validateKeywords(
  keywords: string[],
): { ok: boolean; message: string } {
  for (const raw of keywords) {
    const kw = raw.trim();
    if (!kw) continue;
    if (kw.startsWith('@')) {
      const n = parseInt(kw.slice(1), 10);
      if (Number.isNaN(n) || n <= 0) return { ok: false, message: `@N 需为正整数：${kw}` };
    } else if (kw === '+' || kw === '!' || kw === '@') {
      return { ok: false, message: `修饰符后需跟内容：${kw}` };
    }
  }
  return { ok: true, message: '语法正确' };
}

export function matchItem(item: Item, f: ParsedFilter): boolean {
  const h = `${item.title} ${item.summary ?? ''}`.toLowerCase();
  if (f.exclude.some((w) => h.includes(w))) return false;
  if (f.must.length && !f.must.every((w) => h.includes(w))) return false;
  if (f.any.length && !f.any.some((w) => h.includes(w))) return false;
  return true;
}

/** 命中预览：返回匹配条数 */
export function previewCount(items: Item[], keywords: string[]): number {
  const f = parseKeywords(keywords);
  const count = items.filter((it) => matchItem(it, f)).length;
  return f.limit == null ? count : Math.min(count, f.limit);
}

/** 标题实时搜索过滤 */
export function searchFilter(items: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (it) =>
      it.title.toLowerCase().includes(q) ||
      (it.summary ?? '').toLowerCase().includes(q) ||
      it.sourceName.toLowerCase().includes(q),
  );
}
