import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNews } from './lib/store';
import { prefs } from './lib/prefs';
import { savedArticles, restoreSaved, saveArticle, removeArticle } from './lib/archive';
import { searchFilter } from './lib/filter';
import { CATEGORIES, type Category, type Item } from './types';
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
  const [category, setCategory] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [reader, setReader] = useState<Item | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => prefs.getFavorites());
  const [savedItems, setSavedItems] = useState<Item[]>([]);
  const [favoriteMessage, setFavoriteMessage] = useState<string | null>(null);
  const [archiveReady, setArchiveReady] = useState(false);
  const favoriteBusy = useRef(new Set<string>());
  useEffect(() => {
    let alive = true;
    setArchiveReady(false);
    const ids = [...favorites];
    void savedArticles(ids).then((records) => {
      if (alive) setSavedItems(records.map((r) => r.item));
      return news.index ? restoreSaved(ids, news.items, [...news.index.dates].sort().reverse()) : records;
    }).then((records) => {
      if (alive) setSavedItems(records.map((r) => r.item));
    }).catch((err) => {
      if (alive) setFavoriteMessage(`收藏正文暂未完整保存：${err instanceof Error ? err.message : String(err)}`);
    }).finally(() => { if (alive) setArchiveReady(true); });
    return () => { alive = false; };
  }, [favorites, news.items, news.index]);
  const [readSet, setReadSet] = useState<Set<string>>(() => prefs.getRead());
  const [progress, setProgress] = useState<Record<string, number>>(() => prefs.getProgress());
  // 密度与排序放在 App 状态里：原来只监听 storage 事件，
  // 而该事件只跨标签页触发，同页改了设置资讯页纹丝不动
  const [density, setDensity] = useState(() => prefs.getDensity());
  const [sort, setSort] = useState(() => prefs.getSort());
  const [swUpdate, setSwUpdate] = useState<(() => void) | null>(null);

  // 新版本就绪时提示用户，而不是让新 SW 直接抢占当前页面导致 chunk 版本错配
  useEffect(() => {
    const onUpdate = (e: Event) => {
      setSwUpdate(() => (e as CustomEvent<() => void>).detail);
    };
    window.addEventListener('sw-update', onUpdate);
    return () => window.removeEventListener('sw-update', onUpdate);
  }, []);

  const { categories, counts } = useMemo(() => {
    const counts: Record<string, number> = { [ALL]: news.items.length };
    for (const it of news.items) counts[it.category] = (counts[it.category] ?? 0) + 1;
    // localStorage 里存的是用户上次的顺序，可能还是旧版分类；
    // 新增的分类必须补进去，否则新内容永远不出现在分类栏里
    const saved = prefs.getCategoryOrder();
    const order = saved?.length
      ? [...saved, ...CATEGORIES.filter((c) => !saved.includes(c))]
      : (CATEGORIES as string[]);
    const cats = [ALL, ...order.filter((c) => c !== ALL && counts[c])];
    for (const c of Object.keys(counts)) if (c !== ALL && !cats.includes(c)) cats.push(c);
    return { categories: cats, counts };
  }, [news.items]);

  const visibleItems = useMemo(() => {
    let list = tab === 'saved'
      ? [...new Map([...savedItems, ...news.items.filter((i) => favorites.has(i.id))].map((i) => [i.id, i])).values()]
      : news.items;
    if (tab === 'feed' && category !== ALL) list = list.filter((i) => i.category === category);
    list = searchFilter(list, query);
    if (sort === 'source') {
      list = [...list].sort(
        (a, b) =>
          a.sourceName.localeCompare(b.sourceName, 'zh') || b.publishedAt - a.publishedAt,
      );
    }
    return list;
  }, [news.items, savedItems, tab, category, query, favorites, sort]);
  const unavailableFavorites = [...favorites].filter((id) => !savedItems.some((i) => i.id === id) && !news.byId.has(id)).length;

  const closeReader = useCallback(() => setReader(null), []);

  // 阅读页卸载时会把进度落盘，之后再读回来刷新列表上的"读到 xx%"。
  // 必须放在 effect 里：closeReader 里读会拿到卸载前的旧值。
  useEffect(() => {
    if (!reader) setProgress(prefs.getProgress());
  }, [reader]);

  const openReader = useCallback((item: Item) => {
    setReader(item);
    setReadSet((prev) => (prev.has(item.id) ? prev : new Set(prefs.markRead(item.id))));
    // 接进历史：否则 iOS 侧滑返回和安卓返回键会直接退出 App，而不是关阅读页
    history.pushState({ reader: item.id }, '');
  }, []);

  useEffect(() => {
    const onPop = () => setReader(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 用返回按钮关闭时也要把那条历史记录退掉，避免再按一次返回才真的退出
  const handleClose = useCallback(() => {
    if (history.state?.reader) history.back();
    else closeReader();
  }, [closeReader]);

  const toggleFavorite = useCallback(async (id: string) => {
    if (favoriteBusy.current.has(id)) return;
    favoriteBusy.current.add(id);
    setFavoriteMessage(null);
    try {
      if (prefs.getFavorites().has(id)) {
        const next = prefs.toggleFavorite(id);
        setFavorites(new Set(next));
        setSavedItems((items) => items.filter((i) => i.id !== id));
        await removeArticle(id);
      } else {
        const item = news.byId.get(id) ?? savedItems.find((i) => i.id === id);
        if (!item) throw new Error('找不到文章信息');
        await saveArticle(item);
        setFavorites(new Set(prefs.toggleFavorite(id)));
        setSavedItems((items) => [...items.filter((i) => i.id !== id), item]);
      }
    } catch (err) {
      setFavoriteMessage(`收藏操作未完成：${err instanceof Error ? err.message : String(err)}`);
    } finally { favoriteBusy.current.delete(id); }
  }, [news.byId, savedItems]);

  const today = new Date();
  const dateLabel = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;

  return (
    <div className="flex h-full flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b hairline bg-paper/85 backdrop-blur-md dark:bg-[#14130f]/85">
        <div className="mx-auto max-w-feed px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-baseline gap-2.5">
              <h1 className="title-serif text-[1.55rem] font-bold leading-none">深读</h1>
              <span className="hidden text-xs text-ink-faint sm:inline">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-1">
              {news.fromCache && (
                <span className="chip mr-1 bg-paper-soft text-ink-faint dark:bg-[#232119]">
                  缓存
                </span>
              )}
              <button
                onClick={() => void news.refresh()}
                className="btn-ghost"
                aria-label="刷新"
                disabled={news.loading}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 ${news.loading ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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

      {tab !== 'settings' && news.error && <p role="status" className="px-4 py-2 text-xs text-accent">{news.error}</p>}
      {favoriteMessage && <p role="alert" className="fixed inset-x-4 bottom-20 z-50 rounded-xl bg-paper p-3 text-sm text-accent shadow-pop">{favoriteMessage}<button className="ml-3" onClick={() => setFavoriteMessage(null)}>关闭</button></p>}
      {tab === 'saved' && archiveReady && unavailableFavorites > 0 && <p role="status" className="px-4 py-2 text-xs text-ink-muted">{unavailableFavorites} 篇旧收藏尚未找到正文，可能已超过服务器保留期；收藏记录仍保留。</p>}

      <main className="min-h-0 flex-1">
        {tab === 'settings' ? (
          <div className="h-full overflow-y-auto">
            <SettingsView
              items={news.items}
              density={density}
              sort={sort}
              onDensity={(v) => {
                setDensity(v);
                prefs.setDensity(v);
              }}
              onSort={(v) => {
                setSort(v);
                prefs.setSort(v);
              }}
            />
          </div>
        ) : (tab === 'feed' ? news.loading && !news.items.length : !archiveReady && !visibleItems.length) ? (
          <FeedSkeleton />
        ) : tab === 'feed' && news.error && !news.items.length ? (
          <EmptyState
            title="加载失败"
            desc={news.error}
            action={
              <button className="btn-primary mt-4" onClick={() => void news.refresh()}>
                重试
              </button>
            }
          />
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title={tab === 'saved' ? '还没有收藏' : '没有匹配的条目'}
            desc={
              tab === 'saved'
                ? '在资讯里点书签即可收藏，收藏保存在本机。'
                : '试试切换分类或清空搜索。'
            }
          />
        ) : (
          <div className="mx-auto h-full max-w-feed">
            <FeedList
              // 切分类/搜索时重建列表，顺带把滚动位置归零
              key={`${tab}:${category}:${query}:${sort}`}
              items={visibleItems}
              readSet={readSet}
              progress={progress}
              favorites={favorites}
              density={density}
              onOpen={openReader}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        )}
      </main>

      {swUpdate && (
        <button
          onClick={swUpdate}
          className="fixed inset-x-0 bottom-[4.5rem] z-40 mx-auto flex w-[calc(100%-2rem)] max-w-xs items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-paper shadow-pop dark:bg-[#ece8e1] dark:text-[#14130f]"
        >
          有新版本，点击刷新
        </button>
      )}

      <BottomNav tab={tab} onChange={setTab} savedCount={favorites.size} />

      {reader && (
        <ReaderView
          item={reader}
          favorite={favorites.has(reader.id)}
          onToggleFavorite={toggleFavorite}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="mx-auto max-w-feed space-y-4 px-4 py-5 sm:px-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="space-y-2 border-b hairline pb-4 pt-1">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-5 w-full rounded" />
          <div className="skeleton h-5 w-2/3 rounded" />
          <div className="skeleton h-3.5 w-40 rounded" />
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
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-ink-faint"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
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

export type { Category };
