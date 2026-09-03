import type { Item } from './types.js';

export interface AuthorIndex { updatedAt: number; authors: Record<string, string> }

/** 仅保留 feed 的真实署名；邮箱本身不作为作者展示。 */
export function cleanAuthor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const namedEmail = value.match(/^[^\s@]+@[^\s]+\s+\(([^)]+)\)$/);
  const name = (namedEmail?.[1] ?? value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 200 || /^[^\s@]+@[^\s@]+$/.test(name)) return undefined;
  return name;
}

export function mergeAuthors(previous: AuthorIndex | null, items: Pick<Item, 'id' | 'author'>[]): AuthorIndex {
  const authors = { ...previous?.authors };
  for (const item of items) {
    const author = cleanAuthor(item.author);
    if (author) authors[item.id] = author;
  }
  return { updatedAt: Date.now(), authors };
}
