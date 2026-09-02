import type { Item } from '../../types';
import { timeAgo, categoryColor } from '../../lib/format';
import Thumb from '../Thumb';
import FavButton from '../FavButton';

interface Props {
  item: Item;
  read: boolean;
  favorite: boolean;
  onOpen: (item: Item) => void;
  onToggleFavorite: (id: string) => void;
}

/** 大图头条卡（16:9）：用于首条或用户标星 */
export default function HeroCard({
  item,
  read,
  favorite,
  onOpen,
  onToggleFavorite,
}: Props) {
  return (
    <article
      onClick={() => onOpen(item)}
      className="group cursor-pointer pb-6 pt-2"
    >
      <Thumb src={item.image} alt={item.title} ratio="wide" />
      <div className="mt-3.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2 text-xs text-ink-muted dark:text-[#9a9387]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: categoryColor(item.category) }}
            />
            <span className="font-medium">{item.category}</span>
            <span className="text-ink-faint">·</span>
            <span>{item.sourceName}</span>
            <span className="text-ink-faint">·</span>
            <span>{timeAgo(item.publishedAt)}</span>
          </div>
          <h2
            className={`title-serif text-[1.4rem] font-bold leading-snug transition-colors group-hover:text-accent ${
              read ? 'text-ink-muted dark:text-[#8f887c]' : ''
            }`}
          >
            {item.titleZh || item.title}
          </h2>
          {item.summary && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted dark:text-[#a49d90]">
              {item.summary}
            </p>
          )}
        </div>
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
