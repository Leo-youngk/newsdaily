export type Tab = 'feed' | 'saved' | 'settings';

interface Props {
  tab: Tab;
  onChange: (t: Tab) => void;
  savedCount: number;
}

const TABS: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    id: 'feed',
    label: '资讯',
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
      </svg>
    ),
  },
  {
    id: 'saved',
    label: '收藏',
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 1.8 : 1.6} strokeLinejoin="round">
        <path d="M6 4h12v17l-6-4.2L6 21z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: '设置',
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={a ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1" />
      </svg>
    ),
  },
];

/** 移动端底部 Tab + 安全区适配 */
export default function BottomNav({ tab, onChange, savedCount }: Props) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t hairline bg-paper/92 backdrop-blur-md dark:bg-[#14130f]/92">
      <div className="mx-auto flex max-w-feed">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] transition-colors ${
                active ? 'text-accent' : 'text-ink-faint hover:text-ink-muted'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {t.icon(active)}
              <span>{t.label}</span>
              {t.id === 'saved' && savedCount > 0 && (
                <span className="absolute right-[22%] top-1 min-w-[16px] rounded-full bg-accent px-1 text-[0.6rem] font-semibold leading-4 text-white">
                  {savedCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
