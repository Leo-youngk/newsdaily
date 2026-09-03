import type { Item } from '../types';

export type DirectoryMode = 'source' | 'author';
export interface DirectoryGroup {
  id: string;
  name: string;
  kind: string;
  items: Item[];
}

export function buildDirectory(items: Item[], mode: DirectoryMode): DirectoryGroup[] {
  const groups = new Map<string, DirectoryGroup>();
  for (const item of items) {
    const author = item.author?.trim();
    if (mode === 'author' && !author) continue;
    const name = mode === 'author' ? author! : item.sourceName;
    const id = mode === 'author' ? name.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ') : item.sourceId;
    let group = groups.get(id);
    if (!group) {
      group = { id, name, kind: mode === 'author' ? '作者' : '专栏', items: [] };
      groups.set(id, group);
    }
    if (mode === 'source' && item.audioUrl) group.kind = '节目';
    group.items.push(item);
  }
  for (const group of groups.values()) group.items.sort((a, b) => b.publishedAt - a.publishedAt);
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
