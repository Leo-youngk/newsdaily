interface Props {
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

/** 收藏（书签）按钮：克制线性图标，激活时填充强调色 */
export default function FavButton({ active, onClick, className = '' }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? '取消收藏' : '收藏'}
      aria-pressed={active}
      className={`shrink-0 rounded-full p-1.5 transition-colors hover:bg-paper-soft dark:hover:bg-[#262420] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-[18px] w-[18px] transition-colors ${
          active
            ? 'fill-accent text-accent'
            : 'fill-none text-ink-faint hover:text-ink-muted'
        }`}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="M6 4h12v17l-6-4.2L6 21z" />
      </svg>
    </button>
  );
}
