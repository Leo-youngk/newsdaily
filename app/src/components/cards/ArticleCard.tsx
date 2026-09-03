import { isPending, isTranscript, type Item } from '../../types';
import { timeAgo, categoryColor, readingLabel, durationLabel } from '../../lib/format';
import Thumb from '../Thumb';
import FavButton from '../FavButton';

interface Props {
  item: Item;
  read: boolean;
  /** 阅读进度 0~1，只有读到一半的条目才有 */
  progress?: number;
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
  progress,
  favorite,
  density,
  onOpen,
  onToggleFavorite,
}: Props) {
  const compact = density === 'compact';
  // 27% 的内容超过 20 分钟，读一半退出是常态。
  // 与其显示总时长，不如告诉他还剩多久 —— 这才是决定"现在读不读"的信息。
  const partial = progress != null && progress > 0.02 && progress < 0.98;
  const leftMinutes = partial ? Math.max(1, Math.round(item.readingMinutes * (1 - progress!))) : 0;
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
            {/* 读到一半的条目不另起一个 chip：375px 下这一行本来就挤，
                多一个就会把「逐字稿」折成两行。直接把总时长换成剩余时长，
                信息量更大，占位反而更少。 */}
            {item.readingMinutes > 0 && (
              <span
                className={`whitespace-nowrap ${
                  partial ? 'font-medium text-accent' : 'text-ink-faint dark:text-[#8b8478]'
                }`}
              >
                {partial ? `还剩 ${readingLabel(leftMinutes)}` : readingLabel(item.readingMinutes)}
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
