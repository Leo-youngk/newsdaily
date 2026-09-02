import Parser from 'rss-parser';
import { fetchText } from './fetch.js';
import { config } from './config.js';
import { decodeEntities, parseDate } from './util.js';

export interface RawEntry {
  title: string;
  link: string;
  guid: string;
  publishedAt: number;
  /** description 或 content:encoded 的原始 HTML */
  contentHtml: string;
  /** feed 自带摘要纯文本 */
  summary: string;
  /** media:content / media:thumbnail / media:group 内的图片候选 */
  mediaImages: string[];
  /** enclosure 中 type 为 image 的 URL */
  enclosureImage?: string;
  categories: string[];
}

const parser: Parser = new Parser({
  timeout: config.sourceTimeout,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; NewsPWA/1.0; +https://github.com/news-pwa)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['media:group', 'mediaGroup', { keepArray: true }],
    ],
  },
});

function collectMediaUrls(entry: any): string[] {
  const urls: string[] = [];
  const push = (v: any) => {
    if (!v) return;
    const arr = Array.isArray(v) ? v : [v];
    for (const m of arr) {
      if (typeof m === 'string') urls.push(m);
      else if (m && typeof m === 'object') {
        if (m.$?.url) urls.push(m.$.url);
        if (m.url) urls.push(m.url);
        // media:group 内嵌 media:content
        if (m['media:content']) collectMediaUrls(m['media:content']);
      }
    }
  };
  push(entry.mediaContent);
  push(entry.mediaThumbnail);
  push(entry.mediaGroup);
  return urls.filter((u) => /^https?:\/\//i.test(u));
}

function pickEnclosureImage(entry: any): string | undefined {
  const enc = entry.enclosure;
  if (!enc) return undefined;
  const type: string = enc.type ?? '';
  if (type.startsWith('image/') && enc.url) return enc.url;
  return undefined;
}

function pickLink(entry: any): string {
  if (entry.link) return entry.link;
  // Atom 可能把 link 放在 atomLink
  const al = entry.atomLink;
  if (Array.isArray(al)) {
    const alt = al.find((x: any) => x?.$?.rel === 'alternate');
    if (alt?.$?.href) return alt.$.href;
    if (al[0]?.$?.href) return al[0].$.href;
  } else if (al?.$?.href) {
    return al.$.href;
  }
  return '';
}

/** 抓取并解析单个 feed，返回 RawEntry 列表 */
export async function parseFeed(url: string): Promise<RawEntry[]> {
  // 自己抓取以获得更好的 UA/超时控制，再交给 rss-parser 解析字符串
  const xml = await fetchText(url, {
    timeout: config.sourceTimeout,
    retries: config.retries,
  });
  const feed = await parser.parseString(xml);
  const out: RawEntry[] = [];
  for (const entry of feed.items ?? []) {
    const any = entry as any;
    const contentHtml =
      any.contentEncoded || any.content || any.summary || any.description || '';
    const titleRaw = any.title ?? '';
    const title = decodeEntities(String(titleRaw)).trim();
    if (!title) continue;
    const link = pickLink(any);
    if (!link) continue;
    out.push({
      title,
      link,
      guid: String(any.guid ?? any.id ?? link),
      publishedAt: parseDate(any.isoDate ?? any.pubDate ?? any.date ?? feed.lastBuildDate),
      contentHtml: String(contentHtml),
      summary: String(any.contentSnippet ?? any.summary ?? any.description ?? '').trim(),
      mediaImages: collectMediaUrls(any),
      enclosureImage: pickEnclosureImage(any),
      categories: Array.isArray(any.categories)
        ? any.categories.map((c: any) => (typeof c === 'string' ? c : c?._ ?? '')).filter(Boolean)
        : [],
    });
  }
  return out;
}
