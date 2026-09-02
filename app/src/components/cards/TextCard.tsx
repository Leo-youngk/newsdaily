import type { Item } from '../../types';
import { timeAgo, categoryColor } from '../../lib/format';
import FavButton from '../FavButton';

interface Props {
  item: Item;
  read: boolean;
  favorite: boolean;
  onOpen: (item: Item) => void;
  onToggleFavorite: (id: string) => void;
}

/** 无图紧凑卡（降级）：纯文字 + 分类色点 */
export default function TextCard({
  item,
  read,
  favorite,
  onOpen,
  onToggleFavorite,
}: Props) {
  return (
    <article
      onClick={() => onOpen(item)}
      className="group flex cursor-pointer items-start gap-3 border-b hairline py-3.5"
    >
      <span
        className="mt-[0.45rem] inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: categoryColor(item.category) }}
      />
      <div className="min-w-0 flex-1">
        <h3
          className={`title-serif text-[1.02rem] font-semibold leading-snug transition-colors group-hover:text-accent ${
            read ? 'text-ink-muted dark:text-[#8f887c]' : ''
          }`}
        >
          {item.titleZh || item.title}
        </h3>
        {item.summary && (
          <p className="mt-1 line-clamp-1 text-[0.85rem] leading-relaxed text-ink-muted dark:text-[#a49d90]">
            {item.summary}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 text-[0.72rem] text-ink-faint dark:text-[#8b8478]">
          <span className="font-medium text-ink-muted dark:text-[#9a9387]">
            {item.sourceName}
          </span>
          <span>·</span>
          <span>{timeAgo(item.publishedAt)}</span>
        </div>
      </div>
      <FavButton
        active={favorite}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(item.id);
        }}
      />
    </article>
  );
}
