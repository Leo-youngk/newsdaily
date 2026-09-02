import { createHash } from 'node:crypto';

export function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'fbclid',
  'spm',
  'scm',
  'from',
  'share_token',
  'share_tag',
  'unique_k',
  'wxshare_count',
]);

/** URL 规范化：去掉追踪参数、末尾斜杠、hash，用于去重 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) u.searchParams.delete(key);
    }
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function hostnameOf(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

/** 校验链接域名是否与源声明的 expectedDomain 一致（防链接劫持） */
export function domainMatches(url: string, expected?: string): boolean {
  if (!expected) return true;
  const host = hostnameOf(url);
  if (!host) return false;
  const exp = expected.replace(/^www\./, '').toLowerCase();
  return host === exp || host.endsWith('.' + exp);
}

/** 标题归一化：去空白、标点、小写，用于跨源去重 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。！？、；：""''（）【】《》,.!?;:'"()\[\]<>|—\-–…]/g, '')
    .trim();
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  middot: '·',
  times: '×',
};

export function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITY_MAP[name] ?? m);
}

/** 去除 HTML 标签，得到纯文本 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(s: string, max: number): string {
  if (!s) return s;
  const t = s.trim();
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t;
}

/** 从 HTML 片段里提取第一个 img 的 src */
export function firstImgSrc(html: string): string | undefined {
  if (!html) return undefined;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1]) : undefined;
}

export function parseDate(value?: string | number | null): number {
  if (value == null) return Date.now();
  if (typeof value === 'number') return value;
  const t = Date.parse(value);
  return Number.isNaN(t) ? Date.now() : t;
}

export function todayKey(d = new Date()): string {
  // 以 UTC+8 划分日期，符合中文资讯阅读习惯
  const cn = new Date(d.getTime() + 8 * 3600 * 1000);
  return cn.toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

export function randomUA(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}
