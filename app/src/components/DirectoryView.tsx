import { useMemo, useState } from 'react';
import type { Item } from '../types';
import { buildDirectory, type DirectoryMode } from '../lib/directory';
import { searchFilter } from '../lib/filter';
import { timeAgo } from '../lib/format';
import FeedList from './FeedList';

interface Props {
  items: Item[];
  query: string;
  readSet: Set<string>;
  progress: Record<string, number>;
  favorites: Set<string>;
  density: 'compact' | 'standard';
  onOpen: (item: Item) => void;
  onToggleFavorite: (id: string) => void;
}

export default function DirectoryView({ items, query, ...feedProps }: Props) {
  const [mode, setMode] = useState<DirectoryMode>('source');
  const [selected, setSelected] = useState<string | null>(null);
  const groups = useMemo(() => buildDirectory(items, mode), [items, mode]);
  const active = groups.find((group) => group.id === selected);
  const needle = query.trim().toLocaleLowerCase();
  const visible = groups.filter((group) => !needle || group.name.toLocaleLowerCase().includes(needle) || searchFilter(group.items, query).length > 0);

  if (active) {
    const articles = active.name.toLocaleLowerCase().includes(needle) ? active.items : searchFilter(active.items, query);
    return (
      <section className="mx-auto flex h-full max-w-feed flex-col" aria-label={`${active.name}目录`}>
        <div className="shrink-0 border-b hairline px-4 pb-4 pt-3 sm:px-6">
          <button className="mb-3 flex min-h-10 items-center gap-1 text-sm text-accent" onClick={() => setSelected(null)}>
            <span aria-hidden="true">‹</span> 返回目录
          </button>
          <p className="mb-1 text-[0.7rem] text-ink-faint">{active.kind} · {active.items.length} 篇</p>
          <h2 className="title-serif break-words text-2xl font-semibold">{active.name}</h2>
          <p className="mt-2 text-xs text-ink-muted">按发布时间排列 · {active.items.filter((item) => !feedProps.readSet.has(item.id)).length} 篇未读</p>
        </div>
        <div className="min-h-0 flex-1">
          {articles.length ? <FeedList {...feedProps} items={articles} key={`${active.id}:${query}`} /> : <p className="p-6 text-sm text-ink-muted">这个目录中没有匹配的内容。</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex h-full max-w-feed flex-col" aria-label="内容目录">
      <div className="shrink-0 px-4 pb-3 pt-4 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="title-serif text-2xl font-semibold">循着名字，继续读</h2>
          <span className="shrink-0 text-xs text-ink-faint">{visible.length} 个目录</span>
        </div>
        <div className="mt-4 flex gap-5 border-b hairline" aria-label="目录分组">
          {([['source', '节目与专栏'], ['author', '作者']] as const).map(([value, label]) => (
            <button key={value} onClick={() => { setMode(value); setSelected(null); }} aria-pressed={mode === value}
              className={`min-h-11 border-b-2 pb-2 text-sm ${mode === value ? 'border-accent font-medium text-accent' : 'border-transparent text-ink-muted'}`}>{label}</button>
          ))}
        </div>
        <p className="mt-2 text-[0.7rem] text-ink-faint">{mode === 'author' ? '按原文署名归类；未提供署名的内容仍可在节目与专栏中找到。' : '收录当前保留的内容，每个节目或专栏一本目录。'}</p>
      </div>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-none px-4 pb-4 sm:px-6">
        {!visible.length && <p className="py-8 text-center text-sm text-ink-muted">{needle ? '没有匹配的目录或文章。' : '暂时没有可归类的内容。'}</p>}
        <ul className="divide-y divide-line dark:divide-[#2a2823]">
          {visible.map((group, i) => {
            const unread = group.items.filter((item) => !feedProps.readSet.has(item.id)).length;
            return <li key={group.id}>
              <button className="group flex w-full items-start gap-3 py-4 text-left" onClick={() => setSelected(group.id)} aria-label={`打开${group.name}目录`}>
                <span aria-hidden="true" className="w-6 shrink-0 pt-1 font-mono text-[0.65rem] text-ink-faint">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2"><span className="title-serif break-words text-lg font-semibold group-hover:text-accent">{group.name}</span></span>
                  <span className="mt-1.5 block truncate text-xs text-ink-muted">{group.items[0].titleZh || group.items[0].title}</span>
                  <span className="mt-2 flex flex-wrap gap-x-2 text-[0.68rem] text-ink-faint"><span>{group.kind} · {group.items.length} 篇</span>{unread > 0 && <span className="text-accent">{unread} 未读</span>}<span>更新于{timeAgo(group.items[0].publishedAt)}</span></span>
                </span>
                <span aria-hidden="true" className="self-center text-lg text-ink-faint">›</span>
              </button>
            </li>;
          })}
        </ul>
      </div>
    </section>
  );
}
