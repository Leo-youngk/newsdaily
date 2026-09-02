import { useMemo, useState } from 'react';
import {
  CATEGORIES,
  type AppConfig,
  type Category,
  type Lang,
  type Readable,
  type SourceConfig,
} from '../../types';

interface Props {
  config: AppConfig;
  onChange: (next: AppConfig) => void;
}

const READABLE_LABEL: Record<Readable, string> = {
  full: '全文直达',
  transcript: '逐字稿',
  extract: '需提取',
  transcribe: '自动转写',
};

function genId(name: string): string {
  return (
    'custom-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9一-龥]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

/** 源管理：按分类分组的开关列表 + 添加自定义 RSS */
export default function SourceManager({ config, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<Category>('AI');
  const [lang, setLang] = useState<Lang>('zh');
  const [readable, setReadable] = useState<Readable>('full');

  const grouped = useMemo(() => {
    const g: Record<string, SourceConfig[]> = {};
    for (const s of config.sources) (g[s.category] ??= []).push(s);
    return CATEGORIES.filter((c) => g[c]?.length).map((c) => [c, g[c]] as const);
  }, [config.sources]);

  const patchSource = (id: string, p: Partial<SourceConfig>) => {
    onChange({
      ...config,
      sources: config.sources.map((s) => (s.id === id ? { ...s, ...p } : s)),
    });
  };

  const removeSource = (id: string) => {
    onChange({ ...config, sources: config.sources.filter((s) => s.id !== id) });
  };

  const addSource = () => {
    const u = url.trim();
    if (!name.trim() || !/^https?:\/\//i.test(u)) return;
    let domain: string | undefined;
    try {
      domain = new URL(u).hostname.replace(/^www\./, '');
    } catch {
      domain = undefined;
    }
    const src: SourceConfig = {
      id: genId(name),
      name: name.trim(),
      url: u,
      category,
      lang,
      readable,
      enabled: true,
      limit: 8,
      // 逐字稿类默认门槛高一点，防止只抓到 shownotes 就当成全文
      minChars:
        readable === 'transcript' ? 15000
        : readable === 'transcribe' ? 8000
        : lang === 'zh' ? 1500
        : 4000,
      expectedDomain: domain,
      keywords: [],
    };
    onChange({ ...config, sources: [...config.sources, src] });
    setName('');
    setUrl('');
    setShowAdd(false);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="title-serif text-base font-bold">源管理</h3>
        <button className="btn-outline" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? '取消' : '+ 添加源'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 space-y-3 rounded-2xl border hairline bg-paper-soft p-4 dark:bg-[#1b1a16]">
          <input
            className="input"
            placeholder="名称，如「晚点 LatePost」"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="RSS / Atom 地址 https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <ChipRow
            label="分类"
            options={CATEGORIES.map((c) => [c, c] as [string, string])}
            value={category}
            onChange={(v) => setCategory(v as Category)}
          />
          <ChipRow
            label="语言"
            options={[
              ['zh', '中文'],
              ['en', '英文'],
            ]}
            value={lang}
            onChange={(v) => setLang(v as Lang)}
          />
          <ChipRow
            label="正文来源"
            options={[
              ['full', 'feed 自带全文'],
              ['transcript', '播客有现成稿'],
              ['transcribe', '播客需转写'],
              ['extract', '抓原文页提取'],
            ]}
            value={readable}
            onChange={(v) => setReadable(v as Readable)}
          />
          <button className="btn-primary w-full" onClick={addSource}>
            添加
          </button>
        </div>
      )}

      <div className="space-y-5">
        {grouped.map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {cat}
              {config.categories[cat] === false && (
                <span className="chip bg-paper-soft px-2 py-0 text-[0.65rem] font-normal normal-case text-ink-faint dark:bg-[#232119]">
                  分类已关闭
                </span>
              )}
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border hairline dark:divide-[#2a2823]">
              {list.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-3 bg-paper-card px-3.5 py-2.5 dark:bg-[#1b1a16]"
                >
                  <div className="pt-0.5">
                    <Toggle
                      checked={s.enabled}
                      onChange={(v) => patchSource(s.id, { enabled: v })}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      <span className="chip shrink-0 bg-paper-soft px-1.5 py-0 text-[0.62rem] text-ink-faint dark:bg-[#232119]">
                        {READABLE_LABEL[s.readable]}
                      </span>
                      {s.lang === 'en' && (
                        <span className="chip shrink-0 bg-paper-soft px-1.5 py-0 text-[0.62rem] text-ink-faint dark:bg-[#232119]">
                          EN
                        </span>
                      )}
                    </div>
                    {s.note && (
                      <div className="mt-0.5 line-clamp-2 text-[0.68rem] leading-relaxed text-ink-faint">
                        {s.note}
                      </div>
                    )}
                  </div>
                  <label className="flex shrink-0 items-center gap-1 pt-0.5 text-[0.7rem] text-ink-muted">
                    上限
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={s.limit}
                      onChange={(e) =>
                        patchSource(s.id, {
                          limit: Math.max(1, Math.min(50, +e.target.value || 1)),
                        })
                      }
                      className="w-12 rounded-lg border hairline bg-transparent px-1 py-1 text-center text-xs outline-none focus:border-accent"
                    />
                  </label>
                  {s.id.startsWith('custom-') && (
                    <button
                      onClick={() => removeSource(s.id)}
                      className="shrink-0 rounded-full p-1 text-ink-faint hover:text-accent"
                      aria-label="删除"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                        <path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[0.7rem] font-medium text-ink-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`chip border ${
              value === v
                ? 'border-accent bg-accent-wash text-accent dark:bg-[#241d16]'
                : 'hairline text-ink-muted'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-line dark:bg-[#3a372f]'
      }`}
    >
      {/* 必须显式给 left：button 的 UA 样式是 text-align:center，
          绝对定位元素的静态位置会落在轨道中心，导致滑块往右溢出 20px */}
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
