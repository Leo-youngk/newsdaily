interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/** 实时过滤标题的搜索框 */
export default function SearchBar({ value, onChange, placeholder = '搜索标题…' }: Props) {
  return (
    <div className="relative">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-10 pr-9"
        aria-label="搜索"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="清除"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-faint hover:bg-paper-soft hover:text-ink-muted dark:hover:bg-[#262420]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
