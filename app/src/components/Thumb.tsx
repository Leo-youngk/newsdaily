import { useState } from 'react';
import { resolveImage } from '../lib/api';

interface Props {
  src?: string;
  alt: string;
  ratio: 'square' | 'wide';
  className?: string;
}

/** 懒加载缩略图 + 骨架占位 + 加载失败回退 */
export default function Thumb({ src, alt, ratio, className = '' }: Props) {
  const [state, setState] = useState<'loading' | 'ok' | 'err'>(
    src ? 'loading' : 'err',
  );
  const url = resolveImage(src);
  const aspect = ratio === 'wide' ? 'aspect-[16/9]' : 'aspect-square';

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-paper-soft dark:bg-[#232119] ${aspect} ${className}`}
    >
      {state === 'loading' && <div className="skeleton absolute inset-0" />}
      {url && state !== 'err' ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('err')}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            state === 'ok' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-ink-faint/60"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="m3 15 4-4 5 5 3-3 6 6" />
            <circle cx="8.5" cy="9" r="1.2" />
          </svg>
        </div>
      )}
    </div>
  );
}
