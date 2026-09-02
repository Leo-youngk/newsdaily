import { isPending, isTranscript, type Item } from '../../types';
import { timeAgo, categoryColor, readingLabel, durationLabel } from '../../lib/format';
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

/**
 * 长文/逐字稿卡片。
 * 图片是可选的加分项，没有图也要成立 —— 这批源本来就有一半不带图。
 * 真正要给出的信息是：这是什么、来自哪儿、要读多久。
 */
export default function ArticleCard({
  item,
  read,
  favorite,
  density,
  onOpen,
  onToggleFavorite,
}: Props) {
  const compact = density === 'compact';
  const transcript = isTranscript(item);
  const pending = isPending(item);

  return (
    <article className={`border-b hairline ${compact ? 'py-3' : 'py-4'}`}>
      <div className="flex gap-3.5">
        <div className="min-w-0 flex-1">
          {/* 用真链接：可长按分享、可中键新标签、键盘可达；左键点击仍走站内阅读器 */}
          <a
            href={item.url}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              onOpen(item);
            }}
            className="group block no-underline"
          >
            <div className="mb-1 flex items-center gap-1.5 text-[0.72rem] text-ink-faint dark:text-[#8b8478]">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: categoryColor(item.category) }}
              />
              <span className="truncate font-medium text-ink-muted dark:text-[#9a9387]">
                {item.sourceName}
              </span>
              <span>·</span>
              <span className="shrink-0">{timeAgo(item.publishedAt)}</span>
            </div>

            <h3
              className={`title-serif font-semibold leading-snug transition-colors group-hover:text-accent ${
                compact ? 'text-[1rem] line-clamp-2' : 'text-[1.12rem] line-clamp-3'
              } ${read ? 'text-ink-muted dark:text-[#8f887c]' : ''}`}
            >
              {item.titleZh || item.title}
            </h3>

            {!compact && item.summary && (
              <p className="mt-1.5 line-clamp-2 text-[0.86rem] leading-relaxed text-ink-muted dark:text-[#a49d90]">
                {item.summary}
              </p>
            )}
          </a>

          <div className="mt-2 flex items-center gap-1.5 text-[0.7rem]">
            {transcript && (
              <span className="chip bg-accent-wash px-2 py-0 text-accent dark:bg-[#241d16]">
                逐字稿
              </span>
            )}
            {pending && (
              <span className="chip bg-paper-soft px-2 py-0 text-ink-faint dark:bg-[#232119]">
                转写中
              </span>
            )}
            {item.audioUrl && item.durationSec ? (
              <span className="chip bg-paper-soft px-2 py-0 text-ink-muted dark:bg-[#232119]">
                音频 {durationLabel(item.durationSec)}
              </span>
            ) : null}
            {item.lang === 'en' && (
              <span className="chip bg-paper-soft px-2 py-0 text-ink-faint dark:bg-[#232119]">
                EN
              </span>
            )}
            {item.readingMinutes > 0 && (
              <span className="text-ink-faint dark:text-[#8b8478]">
                {readingLabel(item.readingMinutes)}
              </span>
            )}
            <FavButton
              className="-my-1 ml-auto"
              active={favorite}
              onClick={() => onToggleFavorite(item.id)}
            />
          </div>
        </div>

        {item.image && (
          <Thumb
            src={item.image}
            alt=""
            ratio="square"
            className={`self-start ${compact ? 'w-16' : 'w-20'}`}
          />
        )}
      </div>
    </article>
  );
}
