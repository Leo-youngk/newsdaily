import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, type AppConfig, type Category, type Item } from '../../types';
import { dataApi, putConfig } from '../../lib/api';
import { prefs, applyTheme, type ThemeMode } from '../../lib/prefs';
import { validateKeywords, previewCount } from '../../lib/filter';
import SourceManager, { Toggle } from './SourceManager';

interface Props {
  items: Item[];
  density: 'compact' | 'standard';
  sort: 'time' | 'source';
  onDensity: (v: 'compact' | 'standard') => void;
  onSort: (v: 'time' | 'source') => void;
}

const CATEGORY_HINT: Record<Category, string> = {
  访谈: '长对话逐字稿：80,000 Hours、Dwarkesh、Lex Fridman 等',
  AI: 'AI 研究与工程：Latent Space、Import AI、机器之心等',
  科技: '科技产业与深度报道：ChinaTalk、MIT TR、Asianometry',
  商业: '商业与经济：The Diff、Noahpinion、财新、Stratechery',
  创业: '创业者与产品视角：Not Boring、Lenny’s Newsletter',
  人文: '人物传记与非虚构：人物、The New Yorker、Age of Invention',
  思想: '哲学与观点：Aeon、The Marginalian、Astral Codex Ten',
};

export default function SettingsView({ items, density, sort, onDensity, onSort }: Props) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [token, setToken] = useState(prefs.getAdminToken());
  const [theme, setTheme] = useState<ThemeMode>(prefs.getTheme());
  const [kwSourceId, setKwSourceId] = useState('');
  const [kwText, setKwText] = useState('');

  useEffect(() => {
    dataApi
      .config()
      .then((c) => {
        setConfig(c);
        const first = c.sources.find((s) => s.keywords?.length) || c.sources[0];
        if (first) {
          setKwSourceId(first.id);
          setKwText((first.keywords ?? []).join('\n'));
        }
      })
      .catch((e) => setMsg({ kind: 'err', text: '加载配置失败：' + e.message }))
      .finally(() => setLoading(false));
  }, []);

  const patch = (next: AppConfig) => {
    setConfig(next);
    setDirty(true);
  };

  const kwList = useMemo(
    () => kwText.split('\n').map((x) => x.trim()).filter(Boolean),
    [kwText],
  );
  const kwValidation = validateKeywords(kwList);
  // 命中预览只统计所选源的条目 —— 原来统计全部条目，数字有误导
  const kwScope = useMemo(
    () => items.filter((i) => i.sourceId === kwSourceId),
    [items, kwSourceId],
  );
  const kwPreview = previewCount(kwScope, kwList);

  const selectKwSource = (id: string) => {
    setKwSourceId(id);
    setKwText((config?.sources.find((x) => x.id === id)?.keywords ?? []).join('\n'));
  };

  const commitKeywords = () => {
    if (!config) return;
    patch({
      ...config,
      sources: config.sources.map((s) =>
        s.id === kwSourceId ? { ...s, keywords: kwList } : s,
      ),
    });
  };

  const setDarkMode = (m: ThemeMode) => {
    setTheme(m);
    prefs.setTheme(m);
    applyTheme(m);
    if (config) patch({ ...config, settings: { ...config.settings, darkMode: m } });
  };

  const save = async () => {
    if (!config) return;
    if (!token.trim()) {
      setMsg({ kind: 'err', text: '请先填写管理令牌（Worker 的 ADMIN_TOKEN）' });
      return;
    }
    setSaving(true);
    setMsg(null);
    prefs.setAdminToken(token.trim());
    const next: AppConfig = {
      ...config,
      updatedAt: Date.now(),
      settings: { ...config.settings, density, sort },
    };
    try {
      await putConfig(next, token.trim());
      setConfig(next);
      setDirty(false);
      setMsg({ kind: 'ok', text: '已保存到云端，将于下次抓取生效（每 2 小时一次）' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="space-y-3 p-4">
        <div className="skeleton h-24 w-full rounded-2xl" />
        <div className="skeleton h-40 w-full rounded-2xl" />
      </div>
    );
  if (!config)
    return <div className="p-6 text-center text-sm text-ink-muted">无法加载配置</div>;

  const enabledCount = config.sources.filter(
    (s) => s.enabled && config.categories[s.category] !== false,
  ).length;

  return (
    <div className="mx-auto max-w-feed space-y-8 px-4 pb-32 pt-4 sm:px-6">
      {/* 1. 分类 */}
      <section>
        <h3 className="title-serif mb-1 text-base font-bold">分类</h3>
        <p className="mb-3 text-xs text-ink-muted dark:text-[#9a9387]">
          关掉的分类下所有源都不再采集。当前启用 {enabledCount} 个源。
        </p>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border hairline dark:divide-[#2a2823]">
          {CATEGORIES.map((k) => (
            <li key={k} className="flex items-start gap-3 bg-paper-card px-3.5 py-3 dark:bg-[#1b1a16]">
              <Toggle
                checked={config.categories[k] !== false}
                onChange={(v) =>
                  patch({ ...config, categories: { ...config.categories, [k]: v } })
                }
              />
              <div className="min-w-0">
                <div className="text-sm font-medium">{k}</div>
                <div className="text-[0.7rem] leading-relaxed text-ink-faint">
                  {CATEGORY_HINT[k]}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. 源管理 */}
      <SourceManager config={config} onChange={patch} />

      {/* 3. 关键词过滤 */}
      <section>
        <h3 className="title-serif mb-1 text-base font-bold">关键词过滤</h3>
        <p className="mb-3 text-xs text-ink-muted dark:text-[#9a9387]">
          每行一个：普通词命中任一即留；<code className="text-accent">+词</code> 必须包含；
          <code className="text-accent">!词</code> 排除；<code className="text-accent">@N</code> 每源最多 N 条。留空不过滤。
        </p>
        <select className="input mb-2" value={kwSourceId} onChange={(e) => selectKwSource(e.target.value)}>
          {config.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}（{s.category}）
            </option>
          ))}
        </select>
        <textarea
          className="input min-h-[110px] font-mono text-[0.82rem] leading-relaxed"
          value={kwText}
          onChange={(e) => setKwText(e.target.value)}
          onBlur={commitKeywords}
          placeholder={'AI\n+OpenAI\n!广告\n@20'}
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={kwValidation.ok ? 'text-ink-muted' : 'text-accent'}>
            {kwValidation.message}
          </span>
          <span className="text-ink-faint">
            该源当前 {kwScope.length} 条中命中 {kwPreview} 条
          </span>
        </div>
      </section>

      {/* 4. 显示 */}
      <section className="space-y-4">
        <h3 className="title-serif text-base font-bold">显示</h3>

        <Field label="排版密度">
          <Segmented
            value={density}
            options={[['standard', '标准'], ['compact', '紧凑']]}
            onChange={(v) => onDensity(v as 'standard' | 'compact')}
          />
        </Field>

        <Field label="排序">
          <Segmented
            value={sort}
            options={[['time', '时间'], ['source', '来源']]}
            onChange={(v) => onSort(v as 'time' | 'source')}
          />
        </Field>

        <Field label="暗色模式">
          <Segmented
            value={theme}
            options={[['system', '跟随系统'], ['light', '浅色'], ['dark', '深色']]}
            onChange={(v) => setDarkMode(v as ThemeMode)}
          />
        </Field>

        <Field label="管理令牌（保存配置与调用 AI 都需要）">
          <input
            className="input font-mono text-xs"
            type="password"
            value={token}
            placeholder="Worker 的 ADMIN_TOKEN"
            onChange={(e) => setToken(e.target.value)}
          />
        </Field>
      </section>

      <div className="sticky bottom-16 z-10 -mx-4 border-t hairline bg-paper/90 px-4 py-3 backdrop-blur dark:bg-[#14130f]/90 sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        {msg && (
          <p className={`mb-2 text-xs ${msg.kind === 'ok' ? 'text-ink-muted' : 'text-accent'}`}>
            {msg.text}
          </p>
        )}
        <button
          className={`w-full ${dirty || saving ? 'btn-primary' : 'btn-outline text-ink-faint'}`}
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? '保存中…' : dirty ? '保存到云端' : '没有待保存的改动'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-ink-muted dark:text-[#9a9387]">{label}</div>
      {children}
    </div>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border hairline bg-paper-soft p-0.5 dark:bg-[#1b1a16]">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-[0.6rem] px-3.5 py-1.5 text-sm transition-colors ${
            value === v
              ? 'bg-paper-card font-medium text-ink shadow-sm dark:bg-[#2c2921] dark:text-[#f2eee7]'
              : 'text-ink-muted dark:text-[#9a9387]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
