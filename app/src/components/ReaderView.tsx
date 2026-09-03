import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isPending, isTranscript, type Item, type ItemDetail } from '../types';
import { dataApi } from '../lib/api';
import { summarize, translateBody, translateTitle, type AiResult } from '../lib/ai';
import { fullDate, categoryColor, readingLabel } from '../lib/format';
import { prefs, type FontScale } from '../lib/prefs';

interface Props {
  item: Item;
  onClose: () => void;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

function useAi() {
  const [state, setState] = useState<{ status: Status; result: AiResult }>({
    status: 'idle',
    result: {},
  });
  const run = async (fn: () => Promise<AiResult>) => {
    setState({ status: 'loading', result: {} });
    const result = await fn();
    setState({ status: result.error ? 'error' : 'done', result });
  };
  return { ...state, run };
}

const SCALE_CLASS: Record<FontScale, string> = {
  s: 'text-[0.98rem]',
  m: 'text-[1.0625rem]',
  l: 'text-[1.15rem]',
  xl: 'text-[1.28rem]',
};

export default function ReaderView({ item, onClose, favorite, onToggleFavorite }: Props) {
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(item.contentLen > 0);
  const [scale, setScale] = useState<FontScale>(() => prefs.getFontScale());
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const summary = useAi();
  const titleTr = useAi();
  const bodyTr = useAi();

  // 逐字稿段落带 data-t 秒数：点一下就把音频跳到那儿，边听边读
  const seekFromParagraph = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-t]');
    const audio = audioRef.current;
    if (!el || !audio) return;
    const t = Number(el.dataset.t);
    if (!Number.isFinite(t)) return;
    audio.currentTime = t;
    void audio.play().catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    if (item.contentLen > 0) {
      setLoadingDetail(true);
      dataApi
        .detail(item.id)
        .then((d) => alive && setDetail(d))
        .catch(() => alive && setDetail(null))
        .finally(() => alive && setLoadingDetail(false));
    }
    return () => {
      alive = false;
    };
  }, [item.id, item.contentLen]);

  // 阅读进度：27% 的内容超过 20 分钟，Lex Fridman 平均一篇 166 分钟，
  // 不记位置的话每次退出再进都要从头翻。
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const ratio = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
    setProgress(ratio);
    if (!restoredRef.current) return; // 恢复完成前别把 0 写回去
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => prefs.setProgress(item.id, ratio), 350);
  };

  // 正文渲染完再恢复位置。用 layout effect + rAF：
  // 等这一帧的布局定下来，否则 scrollHeight 还是骨架屏的高度，跳不到位。
  useLayoutEffect(() => {
    if (restoredRef.current || !detail) return;
    const el = scrollRef.current;
    if (!el) return;
    const saved = prefs.getProgress()[item.id] ?? 0;
    const id = requestAnimationFrame(() => {
      const max = el.scrollHeight - el.clientHeight;
      if (saved > 0 && max > 0) el.scrollTop = saved * max;
      restoredRef.current = true;
      onScroll();
    });
    return () => cancelAnimationFrame(id);
  }, [detail, item.id]);

  // 退出时立刻落盘，不等防抖
  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      const el = scrollRef.current;
      if (!el || !restoredRef.current) return;
      const max = el.scrollHeight - el.clientHeight;
      prefs.setProgress(item.id, max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    },
    [item.id],
  );

  const transcript = isTranscript(item);
  const pending = isPending(item);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="fixed inset-0 z-40 touch-pan-y overflow-y-auto overscroll-y-contain bg-paper dark:bg-[#14130f]"
    >
      <header className="sticky top-0 z-10 border-b hairline bg-paper/85 pt-safe backdrop-blur-md dark:bg-[#14130f]/85">
        <div className="mx-auto flex max-w-reading items-center gap-1 px-4 py-2.5">
          <button onClick={onClose} className="btn-ghost -ml-1.5" aria-label="返回">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 truncate text-xs text-ink-muted dark:text-[#9a9387]">
            {item.sourceName}
          </div>

          {/* 字号：长文阅读器该有的选择权 */}
          <div className="flex items-center rounded-full border hairline">
            {(['s', 'm', 'l', 'xl'] as FontScale[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScale(s);
                  prefs.setFontScale(s);
                }}
                aria-label={`字号 ${s}`}
                aria-pressed={scale === s}
                className={`px-2 py-1 text-[0.7rem] transition-colors first:rounded-l-full last:rounded-r-full ${
                  scale === s
                    ? 'bg-accent-wash font-semibold text-accent dark:bg-[#241d16]'
                    : 'text-ink-faint'
                }`}
              >
                A
              </button>
            ))}
          </div>

          <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-ghost" aria-label="打开原文">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>
          <button onClick={() => onToggleFavorite(item.id)} className="btn-ghost" aria-label={favorite ? '取消收藏' : '收藏'}>
            <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${favorite ? 'fill-accent text-accent' : 'fill-none text-ink-muted'}`} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
              <path d="M6 4h12v17l-6-4.2L6 21z" />
            </svg>
          </button>
        </div>
        {/* 进度条压在 header 底边上：绝对定位不占高度，正文加载完也不会把页面顶下去 */}
        <div className="absolute inset-x-0 bottom-0 h-[2px]" aria-hidden>
          <div
            className="h-full bg-accent/70 transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </header>

      <article className="mx-auto max-w-reading px-5 pb-24 pt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-[#9a9387]">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(item.category) }} />
          <span className="font-medium">{item.category}</span>
          <span className="text-ink-faint">·</span>
          <span>{fullDate(item.publishedAt)}</span>
          {item.readingMinutes > 0 && (
            <>
              <span className="text-ink-faint">·</span>
              <span>{readingLabel(item.readingMinutes)}</span>
            </>
          )}
          {transcript && (
            <span className="chip bg-accent-wash px-2 py-0 text-accent dark:bg-[#241d16]">逐字稿</span>
          )}
          {pending && (
            <span className="chip bg-paper-soft px-2 py-0 text-ink-faint dark:bg-[#232119]">转写中</span>
          )}
        </div>

        <h1 className="title-serif text-[1.75rem] font-bold leading-tight">
          {item.titleZh || item.title}
        </h1>

        {/* 播客：正文是逐字稿，但音频也该能边听边读 */}
        {item.audioUrl && (
          <audio
            ref={audioRef}
            controls
            preload="none"
            src={item.audioUrl}
            className="mt-4 w-full"
          />
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => summary.run(() => summarize(item.id))} disabled={!item.contentLen}>
            <Dot status={summary.status} /> 生成摘要
          </button>
          {item.lang === 'en' && (
            <button className="btn-outline" onClick={() => titleTr.run(() => translateTitle(item.id, item.title))}>
              <Dot status={titleTr.status} /> 翻译标题
            </button>
          )}
          {item.lang === 'en' && item.contentLen > 0 && (
            <button className="btn-outline" onClick={() => bodyTr.run(() => translateBody(item.id))}>
              <Dot status={bodyTr.status} /> 翻译全文
            </button>
          )}
        </div>

        <AiBlock label="AI 摘要" state={summary} />
        <AiBlock label="标题译文" state={titleTr} />

        <div className="mt-6">
          {loadingDetail && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-4 w-full rounded" />
              ))}
            </div>
          )}
          {detail ? (
            <>
              <div
                className={`prose-news ${SCALE_CLASS[scale]}`}
                onClick={item.audioUrl ? seekFromParagraph : undefined}
                dangerouslySetInnerHTML={{ __html: detail.contentHtml }}
              />
              <AiBlock label="全文译文" state={bodyTr} />
            </>
          ) : (
            !loadingDetail && (
              <div className="rounded-2xl border hairline bg-paper-soft p-5 dark:bg-[#1b1a16]">
                <p className="mb-3 text-xs leading-relaxed text-ink-faint">
                  {pending
                    ? '这集还在转写队列里（中文播客没有现成文字稿，由 whisper 自动转写，通常几小时内完成）。可以先听音频。'
                    : '这条的正文暂时取不到（付费墙、动态渲染或反爬）。以下是摘要。'}
                </p>
                {item.summary ? (
                  <p className="font-serif text-[1.02rem] leading-[1.85] text-ink-soft dark:text-[#d8d2c8]">
                    {item.summary}
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">该源未提供摘要。</p>
                )}
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4">
                  阅读原文
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </a>
              </div>
            )
          )}
        </div>

        <footer className="mt-10 border-t hairline pt-4 text-xs text-ink-faint">
          来源：{item.sourceName} ·{' '}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="link-accent">
            查看原文
          </a>
        </footer>
      </article>
    </div>
  );
}

function Dot({ status }: { status: Status }) {
  if (status === 'loading')
    return <span className="mr-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />;
  return null;
}

function AiBlock({ label, state }: { label: string; state: ReturnType<typeof useAi> }) {
  if (state.status === 'idle') return null;
  return (
    <div className="mt-4 rounded-2xl border border-accent/20 bg-accent-wash/60 p-4 dark:border-accent/25 dark:bg-[#241d16]">
      <div className="mb-1.5 flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wide text-accent">
        {label}
        {state.result.cached && <span className="chip bg-white/60 text-ink-faint dark:bg-black/20">缓存</span>}
        {state.result.model && <span className="chip bg-white/60 text-ink-faint dark:bg-black/20">{state.result.model}</span>}
      </div>
      {state.status === 'loading' && (
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-full rounded" />
          <div className="skeleton h-3.5 w-4/5 rounded" />
        </div>
      )}
      {state.status === 'error' && (
        <p className="text-sm text-accent">{state.result.error || '生成失败'}</p>
      )}
      {state.status === 'done' && (
        <p className="whitespace-pre-wrap font-serif text-[1rem] leading-[1.8] text-ink-soft dark:text-[#ddd6ca]">
          {state.result.text}
        </p>
      )}
    </div>
  );
}
