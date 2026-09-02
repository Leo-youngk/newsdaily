interface Props {
  categories: string[];
  active: string;
  counts: Record<string, number>;
  onChange: (c: string) => void;
}

/** 顶部横向滚动分类 Tab（Substack 式：文字 Tab + 强调色下划线） */
export default function CategoryTabs({ categories, active, counts, onChange }: Props) {
  return (
    <nav
      className="no-scrollbar allow-pan-x flex gap-1 overflow-x-auto px-1"
      aria-label="分类"
    >
      {categories.map((c) => {
        const isActive = c === active;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm transition-colors ${
              isActive
                ? 'font-semibold text-ink dark:text-[#f2eee7]'
                : 'text-ink-muted hover:text-ink dark:text-[#9a9387] dark:hover:text-[#e6e1d7]'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {c}
            {counts[c] != null && (
              <span className="ml-1 text-[0.68rem] text-ink-faint dark:text-[#7d766a]">
                {counts[c]}
              </span>
            )}
            {isActive && (
              <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
