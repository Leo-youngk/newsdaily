import { useEffect, useState } from 'react';
import type { Item, ItemDetail } from '../types';
import { dataApi, resolveImage } from '../lib/api';
import { summarize, translate, type AiResult } from '../lib/ai';
import { fullDate, categoryColor } from '../lib/format';
import Thumb from './Thumb';

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
  return { ...state, run, reset: () => setState({ status: 'idle', result: {} }) };
}

/** 正文阅读页 + AI 摘要/翻译块 */
export default function ReaderView({ item, onClose, favorite, onToggleFavorite }: Props) {
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const summary = useAi();
  const titleTr = useAi();
  const bodyTr = useAi();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.style.overflow = 'hidden';
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
      document.body.style.overflow = '';
    };
  }, [item.id, item.contentLen]);

  const bodyText = detail?.contentText ?? item.summary ?? '';

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper dark:bg-[#14130f]">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 border-b hairline bg-paper/85 pt-safe backdrop-blur-md dark:bg-[#14130f]/85">
        <div className="mx-auto flex max-w-reading items-center gap-2 px-4 py-2.5">
          <button onClick={onClose} className="btn-ghost -ml-1.5" aria-label="返回">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 truncate text-xs text-ink-muted dark:text-[#9a9387]">
            {item.sourceName}
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            aria-label="打开原文"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </a>
          <button
            onClick={() => onToggleFavorite(item.id)}
            className="btn-ghost"
            aria-label={favorite ? '取消收藏' : '收藏'}
          >
            <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] ${favorite ? 'fill-accent text-accent' : 'fill-none text-ink-muted'}`} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
              <path d="M6 4h12v17l-6-4.2L6 21z" />
            </svg>
          </button>
        </div>
      </header>

      <article className="mx-auto max-w-reading px-5 pb-24 pt-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-ink-muted dark:text-[#9a9387]">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(item.category) }} />
          <span className="font-medium">{item.category}</span>
          <span className="text-ink-faint">·</span>
          <span>{fullDate(item.publishedAt)}</span>
        </div>

        <h1 className="title-serif text-[1.75rem] font-bold leading-tight">
          {item.titleZh || item.title}
        </h1>

        {/* AI 操作条 */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-outline" onClick={() => summary.run(() => summarize(item.id, bodyText))} disabled={!bodyText}>
            <Dot status={summary.status} /> 生成摘要
          </button>
          <button className="btn-outline" onClick={() => titleTr.run(() => translate(item.id, item.title, 'title'))}>
            <Dot status={titleTr.status} /> 翻译标题
          </button>
          {bodyText && (
            <button className="btn-outline" onClick={() => bodyTr.run(() => translate(item.id, bodyText, 'body'))}>
              <Dot status={bodyTr.status} /> 翻译全文
            </button>
          )}
        </div>

        <AiBlock label="AI 摘要" state={summary} />
        <AiBlock label="标题译文" state={titleTr} />

        {item.image && (
          <Thumb src={item.image} alt={item.title} ratio="wide" className="mt-6" />
        )}

        {/* 正文 */}
        <div className="mt-6">
          {loadingDetail && <div className="skeleton h-40 w-full rounded-xl" />}
          {detail ? (
            <>
              <div
                className="prose-news"
                dangerouslySetInnerHTML={{ __html: detail.contentHtml }}
              />
              <AiBlock label="全文译文" state={bodyTr} />
            </>
          ) : (
            !loadingDetail && (
              <div className="rounded-2xl border hairline bg-paper-soft p-5 dark:bg-[#1b1a16]">
                <p className="mb-3 text-xs leading-relaxed text-ink-faint">
                  这篇暂未提取到可离线阅读的正文（可能因付费墙、动态加载或反爬限制）。以下为摘要，完整内容请查看原文。
                </p>
                {item.summary ? (
                  <p className="font-serif text-[1.02rem] leading-[1.85] text-ink-soft dark:text-[#d8d2c8]">
                    {item.summary}
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">该源未提供摘要。</p>
                )}
                <AiBlock label="全文译文" state={bodyTr} />
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
          {item.image && resolveImage(item.image) ? ' · 封面已转存' : ''}
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
