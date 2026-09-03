import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Item } from '../types';
import ArticleCard from './cards/ArticleCard';

interface Props {
  items: Item[];
  readSet: Set<string>;
  progress: Record<string, number>;
  favorites: Set<string>;
  density: 'compact' | 'standard';
  onOpen: (item: Item) => void;
  onToggleFavorite: (id: string) => void;
}

/** 长列表虚拟滚动。卡片高度不固定（标题 2-3 行、有无图、有无标签），交给 measureElement 实测 */
export default function FeedList({
  items,
  readSet,
  progress,
  favorites,
  density,
  onOpen,
  onToggleFavorite,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (density === 'compact' ? 104 : 148),
    overscan: 6,
    getItemKey: (i) => items[i].id,
  });

  return (
    <div
      ref={parentRef}
      // iOS Safari 不支持 overscroll-behavior，横滑只能用 touch-action 拦
      className="h-full touch-pan-y overflow-y-auto overscroll-y-contain"
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            ref={virtualizer.measureElement}
            data-index={v.index}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${v.start}px)` }}
          >
            <div className="px-4 sm:px-6">
              <ArticleCard
                item={items[v.index]}
                read={readSet.has(items[v.index].id)}
                progress={progress[items[v.index].id]}
                favorite={favorites.has(items[v.index].id)}
                density={density}
                onOpen={onOpen}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
