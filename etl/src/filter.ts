import type { Item } from './types.js';

/**
 * 关键词过滤（TrendRadar DSL 子集）：
 *   普通词  命中任一即保留
 *   +词     必须词，需全部命中
 *   !词     排除词，命中即丢弃
 *   @N      每源最多保留 N 条
 *   留空    不过滤，全量保留
 * 匹配针对 标题 + 摘要，大小写不敏感。
 */

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

function haystack(item: Item): string {
  return `${item.title} ${item.summary ?? ''}`.toLowerCase();
}

function matchItem(item: Item, f: ParsedFilter): boolean {
  const h = haystack(item);
  if (f.exclude.some((w) => h.includes(w))) return false;
  if (f.must.length && !f.must.every((w) => h.includes(w))) return false;
  if (f.any.length && !f.any.some((w) => h.includes(w))) return false;
  return true;
}

export function applyKeywords(items: Item[], keywords: string[] = []): Item[] {
  const f = parseKeywords(keywords);
  const noFilter =
    !f.any.length && !f.must.length && !f.exclude.length && f.limit == null;
  if (noFilter) return items;

  let kept = items.filter((it) => matchItem(it, f));
  if (f.limit != null) {
    // @N 每源最多 N 条（此处按传入的单一源批次调用，直接截断）
    kept = kept.slice(0, f.limit);
  }
  return kept;
}

/** 供前端设置页做实时语法校验与命中预览 */
export function validateKeywords(keywords: string[]): { ok: boolean; message: string } {
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
