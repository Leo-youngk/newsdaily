import type { Item } from '../../types';
import { timeAgo, categoryColor } from '../../lib/format';
import Thumb from '../Thumb';
import FavButton from '../FavButton';

interface Props {
  item: Item;
  read: boolean;
  favorite: boolean;
  density: 'compact' | 'standard';
  onOpen: (item: Item) => void;
  onToggleFavorite: (id: string) => void;
}

/** 左图右文卡（默认，1:1 缩略图） */
export default function RowCard({
  item,
  read,
  favorite,
  density,
  onOpen,
  onToggleFavorite,
}: Props) {
  const compact = density === 'compact';
  return (
    <article
      onClick={() => onOpen(item)}
      className={`group flex cursor-pointer gap-3.5 border-b hairline ${
        compact ? 'py-3' : 'py-4'
      }`}
    >
      <div className="min-w-0 flex-1">
        <h3
          className={`title-serif font-semibold leading-snug transition-colors group-hover:text-accent ${
            compact ? 'text-[0.98rem] line-clamp-2' : 'text-[1.08rem] line-clamp-2'
          } ${read ? 'text-ink-muted dark:text-[#8f887c]' : ''}`}
        >
          {item.titleZh || item.title}
        </h3>
        {!compact && item.summary && (
          <p className="mt-1.5 line-clamp-1 text-[0.86rem] leading-relaxed text-ink-muted dark:text-[#a49d90]">
            {item.summary}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] text-ink-faint dark:text-[#8b8478]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: categoryColor(item.category) }}
          />
          <span className="font-medium text-ink-muted dark:text-[#9a9387]">
            {item.sourceName}
          </span>
          <span>·</span>
          <span>{timeAgo(item.publishedAt)}</span>
        </div>
      </div>

      <div className="flex items-start gap-1">
        {item.image && (
          <Thumb
            src={item.image}
            alt={item.title}
            ratio="square"
            className={compact ? 'w-16' : 'w-24'}
          />
        )}
        <FavButton
          active={favorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
        />
      </div>
    </article>
  );
}
