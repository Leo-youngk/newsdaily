import { useEffect, useMemo, useState } from 'react';
import { useNews } from './lib/store';
import { prefs } from './lib/prefs';
import { searchFilter } from './lib/filter';
import type { Item } from './types';
import CategoryTabs from './components/CategoryTabs';
import SearchBar from './components/SearchBar';
import FeedList from './components/FeedList';
import ReaderView from './components/ReaderView';
import SettingsView from './components/settings/SettingsView';
import BottomNav, { type Tab } from './components/BottomNav';

const ALL = '全部';

export default function App() {
  const news = useNews();
  const [tab, setTab] = useState<Tab>('feed');
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  const [reader, setReader] = useState<Item | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => prefs.getFavorites());
  const [readSet, setReadSet] = useState<Set<string>>(() => prefs.getRead());
  const [density, setDensity] = useState(prefs.getDensity());
  const [sort, setSort] = useState(prefs.getSort());

  // 分类列表（含计数）
  const { categories, counts } = useMemo(() => {
    const counts: Record<string, number> = { [ALL]: news.items.length };
    for (const it of news.items) counts[it.category] = (counts[it.category] ?? 0) + 1;
    const order =
      prefs.getCategoryOrder() ?? Object.keys(news.index?.categories ?? {});
    const cats = [ALL, ...order.filter((c) => c !== ALL && counts[c])];
    // 补齐 order 未覆盖的分类
    for (const c of Object.keys(counts)) if (c !== ALL && !cats.includes(c)) cats.push(c);
    return { categories: cats, counts };
  }, [news.items, news.index]);

  const visibleItems = useMemo(() => {
    let list = news.items;
    if (tab === 'saved') list = list.filter((i) => favorites.has(i.id));
    if (category !== ALL) list = list.filter((i) => i.category === category);
    list = searchFilter(list, query);
    if (sort === 'source') {
      list = [...list].sort(
        (a, b) =>
          a.sourceName.localeCompare(b.sourceName, 'zh') ||
          b.publishedAt - a.publishedAt,
      );
    }
    return list;
  }, [news.items, tab, category, query, favorites, sort]);

  const openReader = (item: Item) => {
    setReader(item);
    setReadSet((prev) => {
      if (prev.has(item.id)) return prev;
      const next = prefs.markRead(item.id);
      return new Set(next);
    });
  };

  const toggleFavorite = (id: string) => {
    setFavorites(new Set(prefs.toggleFavorite(id)));
  };

  // 阅读器打开时同步密度/排序设置的实时变化
  useEffect(() => {
    const onStorage = () => {
      setDensity(prefs.getDensity());
      setSort(prefs.getSort());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const today = new Date();
  const dateLabel = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;

  return (
    <div className="flex h-full flex-col">
      {/* 报头 */}
      <header className="pt-safe sticky top-0 z-20 border-b hairline bg-paper/85 backdrop-blur-md dark:bg-[#14130f]/85">
        <div className="mx-auto max-w-feed px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-baseline gap-2.5">
              <h1 className="title-serif text-[1.55rem] font-bold leading-none">深读</h1>
              <span className="hidden text-xs text-ink-faint sm:inline">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              {news.fromCache && (
                <span className="chip mr-1 bg-paper-soft text-ink-faint dark:bg-[#232119]">离线</span>
              )}
              <button
                onClick={() => void news.refresh()}
                className="btn-ghost"
                aria-label="刷新"
                disabled={news.loading}
              >
                <svg viewBox="0 0 24 24" className={`h-5 w-5 ${news.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 11a8 8 0 1 0-1.5 6M20 5v6h-6" />
                </svg>
              </button>
            </div>
          </div>

          {tab !== 'settings' && (
            <>
              <div className="pb-2.5">
                <SearchBar value={query} onChange={setQuery} />
              </div>
              {tab === 'feed' && (
                <div className="-mx-1 border-t hairline pt-0.5">
                  <CategoryTabs
                    categories={categories}
                    active={category}
                    counts={counts}
                    onChange={setCategory}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* 主体 */}
      <main className="min-h-0 flex-1">
        {tab === 'settings' ? (
          <div className="h-full overflow-y-auto">
            <SettingsView items={news.items} />
          </div>
        ) : news.loading && !news.items.length ? (
          <FeedSkeleton />
        ) : news.error && !news.items.length ? (
          <EmptyState
            title="加载失败"
            desc={news.error}
            action={<button className="btn-primary mt-4" onClick={() => void news.refresh()}>重试</button>}
          />
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title={tab === 'saved' ? '还没有收藏' : '没有匹配的条目'}
            desc={tab === 'saved' ? '在资讯里点书签即可收藏，收藏保存在本机。' : '试试切换分类或清空搜索。'}
          />
        ) : (
          <div className="mx-auto h-full max-w-feed">
            <FeedList
              items={visibleItems}
              readSet={readSet}
              favorites={favorites}
              density={density}
              onOpen={openReader}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        )}
      </main>

      <BottomNav tab={tab} onChange={setTab} savedCount={favorites.size} />

      {reader && (
        <ReaderView
          item={reader}
          favorite={favorites.has(reader.id)}
          onToggleFavorite={toggleFavorite}
          onClose={() => setReader(null)}
        />
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="mx-auto max-w-feed space-y-4 px-4 py-5 sm:px-6">
      <div className="skeleton aspect-[16/9] w-full rounded-xl" />
      <div className="skeleton h-6 w-3/4 rounded" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-3.5 border-b hairline pb-4 pt-1">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
          <div className="skeleton h-24 w-24 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-paper-soft dark:bg-[#232119]">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 5h16v14H4z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      </div>
      <h3 className="title-serif text-lg font-bold">{title}</h3>
      {desc && <p className="mt-1 max-w-xs text-sm text-ink-muted dark:text-[#9a9387]">{desc}</p>}
      {action}
    </div>
  );
}
