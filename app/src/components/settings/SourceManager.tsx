import { useMemo, useState } from 'react';
import type { AppConfig, SourceConfig } from '../../types';

interface Props {
  config: AppConfig;
  onChange: (next: AppConfig) => void;
}

const CATEGORIES = ['科技', 'AI', '财经', '国际', '开源', '自定义'];

function genId(name: string): string {
  return (
    'custom-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24) +
    '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

/** 源管理：按分类分组的开关列表 + 添加自定义源 */
export default function SourceManager({ config, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<'rss' | 'gnews'>('rss');
  const [name, setName] = useState('');
  const [urlOrKeyword, setUrlOrKeyword] = useState('');
  const [category, setCategory] = useState('科技');

  const grouped = useMemo(() => {
    const g: Record<string, SourceConfig[]> = {};
    for (const s of config.sources) (g[s.category] ??= []).push(s);
    return g;
  }, [config.sources]);

  const patchSource = (id: string, patch: Partial<SourceConfig>) => {
    onChange({
      ...config,
      sources: config.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const removeSource = (id: string) => {
    onChange({ ...config, sources: config.sources.filter((s) => s.id !== id) });
  };

  const addSource = () => {
    const value = urlOrKeyword.trim();
    if (!name.trim() || !value) return;
    let url = value;
    let type: 'rss' | 'gnews' = addType;
    if (addType === 'gnews') {
      // 关键词或 site: 语法 → Google News 搜索源
      const q = value.startsWith('site:') ? value : value;
      url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
    }
    const domain = (() => {
      try {
        if (type === 'rss') return new URL(url).hostname.replace(/^www\./, '');
        const m = value.match(/site:([^/\s]+)/);
        return m ? m[1] : undefined;
      } catch {
        return undefined;
      }
    })();
    const src: SourceConfig = {
      id: genId(name),
      name: name.trim(),
      url,
      type,
      category,
      kind: type === 'gnews' ? 'keyword' : 'deep',
      enabled: true,
      limit: 20,
      expectedDomain: domain,
      offlineReading: false,
      keywords: [],
    };
    onChange({ ...config, sources: [...config.sources, src] });
    setName('');
    setUrlOrKeyword('');
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
          <div className="flex gap-2">
            {(['rss', 'gnews'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAddType(t)}
                className={`chip border ${
                  addType === t
                    ? 'border-accent bg-accent-wash text-accent dark:bg-[#241d16]'
                    : 'hairline text-ink-muted'
                }`}
              >
                {t === 'rss' ? '自定义 RSS' : 'Google News 关键词'}
              </button>
            ))}
          </div>
          <input className="input" placeholder="名称，如「晚点 LatePost」" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            placeholder={addType === 'rss' ? 'RSS/Atom 地址 https://…' : '关键词或 site:example.com'}
            value={urlOrKeyword}
            onChange={(e) => setUrlOrKeyword(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`chip border ${
                  category === c
                    ? 'border-accent bg-accent-wash text-accent dark:bg-[#241d16]'
                    : 'hairline text-ink-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button className="btn-primary w-full" onClick={addSource}>
            添加
          </button>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {cat}
            </div>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border hairline dark:divide-[#2a2823]">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-3 bg-paper-card px-3.5 py-2.5 dark:bg-[#1b1a16]">
                  <Toggle checked={s.enabled} onChange={(v) => patchSource(s.id, { enabled: v })} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="truncate text-[0.7rem] text-ink-faint">
                      {s.type === 'gnews' ? '关键词源' : 'RSS'} · {s.url}
                    </div>
                  </div>
                  <label className="flex items-center gap-1 text-[0.7rem] text-ink-muted">
                    上限
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={s.limit}
                      onChange={(e) => patchSource(s.id, { limit: Math.max(1, Math.min(100, +e.target.value || 1)) })}
                      className="w-14 rounded-lg border hairline bg-transparent px-1.5 py-1 text-center text-xs outline-none focus:border-accent"
                    />
                  </label>
                  {s.id.startsWith('custom-') && (
                    <button onClick={() => removeSource(s.id)} className="rounded-full p-1 text-ink-faint hover:text-accent" aria-label="删除">
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
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[1.4rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
