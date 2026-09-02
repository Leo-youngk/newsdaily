import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Item } from '../types';
import HeroCard from './cards/HeroCard';
import RowCard from './cards/RowCard';
import TextCard from './cards/TextCard';

interface Props {
  items: Item[];
  readSet: Set<string>;
  favorites: Set<string>;
  density: 'compact' | 'standard';
  onOpen: (item: Item) => void;
  onToggleFavorite: (id: string) => void;
}

/** 长列表虚拟滚动；首条有图用 HeroCard，其余有图 RowCard、无图 TextCard */
export default function FeedList({
  items,
  readSet,
  favorites,
  density,
  onOpen,
  onToggleFavorite,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (density === 'compact' ? 92 : 132),
    overscan: 8,
    getItemKey: (i) => items[i].id,
  });

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const item = items[v.index];
          const isHero = v.index === 0 && !!item.image;
          return (
            <div
              key={v.key}
              ref={virtualizer.measureElement}
              data-index={v.index}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${v.start}px)` }}
            >
              <div className="px-4 sm:px-6">
                {isHero ? (
                  <HeroCard
                    item={item}
                    read={readSet.has(item.id)}
                    favorite={favorites.has(item.id)}
                    onOpen={onOpen}
                    onToggleFavorite={onToggleFavorite}
                  />
                ) : item.image ? (
                  <RowCard
                    item={item}
                    read={readSet.has(item.id)}
                    favorite={favorites.has(item.id)}
                    density={density}
                    onOpen={onOpen}
                    onToggleFavorite={onToggleFavorite}
                  />
                ) : (
                  <TextCard
                    item={item}
                    read={readSet.has(item.id)}
                    favorite={favorites.has(item.id)}
                    onOpen={onOpen}
                    onToggleFavorite={onToggleFavorite}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
