import Parser from 'rss-parser';
import { fetchText } from './fetch.js';
import { config } from './config.js';
import { decodeEntities, parseDate, parseDuration } from './util.js';

export interface TranscriptRef {
  url: string;
  type: string; // text/plain, text/html, text/vtt, application/json, application/x-subrip
}

export interface RawEntry {
  title: string;
  link: string;
  guid: string;
  publishedAt: number;
  /** content:encoded 或 description 的原始 HTML —— readable=full 的源直接吃这个 */
  contentHtml: string;
  /** feed 自带摘要纯文本 */
  summary: string;
  /** <podcast:transcript> 声明的文稿文件 */
  transcripts: TranscriptRef[];
  /** 音频直链与时长（播客） */
  audioUrl?: string;
  durationSec?: number;
  /** 封面图候选（可选，图片不是必需品） */
  imageCandidate?: string;
  categories: string[];
}

const parser: Parser = new Parser({
  timeout: config.sourceTimeout,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; NewsPWA/2.0; +https://github.com/news-pwa)',
    Accept:
      'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['podcast:transcript', 'podcastTranscript', { keepArray: true }],
      ['itunes:duration', 'itunesDuration'],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
    ],
  },
});

function collectTranscripts(entry: any): TranscriptRef[] {
  const raw = entry.podcastTranscript;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: TranscriptRef[] = [];
  for (const t of arr) {
    const attrs = t?.$ ?? t;
    const url = attrs?.url;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
    // rel="captions" 是字幕文件，逐字稿优先，但没别的时也能用
    out.push({ url, type: String(attrs?.type ?? '') });
  }
  // 排序偏好：纯文本 > html > json > vtt > srt
  const rank = (t: string) =>
    t.includes('plain') ? 0
    : t.includes('html') ? 1
    : t.includes('json') ? 2
    : t.includes('vtt') ? 3
    : 4;
  return out.sort((a, b) => rank(a.type) - rank(b.type));
}

function pickAudio(entry: any): string | undefined {
  const enc = entry.enclosure;
  if (enc?.url && String(enc.type ?? '').startsWith('audio/')) return enc.url;
  return undefined;
}

function pickImage(entry: any): string | undefined {
  const push = (v: any): string | undefined => {
    if (!v) return undefined;
    const arr = Array.isArray(v) ? v : [v];
    for (const m of arr) {
      const u = typeof m === 'string' ? m : m?.$?.url ?? m?.url;
      if (typeof u === 'string' && /^https?:\/\//i.test(u)) return u;
    }
    return undefined;
  };
  const media = push(entry.mediaContent) ?? push(entry.mediaThumbnail);
  if (media) return media;
  const enc = entry.enclosure;
  if (enc?.url && String(enc.type ?? '').startsWith('image/')) return enc.url;
  const html: string = entry.contentEncoded || entry.content || entry.description || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1]) : undefined;
}

function pickLink(entry: any): string {
  if (entry.link) return String(entry.link).trim();
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

/** 抓取并解析单个 feed */
export async function parseFeed(url: string): Promise<RawEntry[]> {
  const xml = await fetchText(url, {
    timeout: config.sourceTimeout,
    retries: config.retries,
  });
  const feed = await parser.parseString(xml);
  const out: RawEntry[] = [];
  for (const entry of feed.items ?? []) {
    const any = entry as any;
    const title = decodeEntities(String(any.title ?? '')).trim();
    if (!title) continue;
    const link = pickLink(any);
    if (!link) continue;
    out.push({
      title,
      link,
      guid: String(any.guid ?? any.id ?? link),
      publishedAt: parseDate(any.isoDate ?? any.pubDate ?? any.date ?? feed.lastBuildDate),
      contentHtml: String(
        any.contentEncoded || any.content || any.summary || any.description || '',
      ),
      summary: String(any.contentSnippet ?? any.summary ?? any.description ?? '').trim(),
      transcripts: collectTranscripts(any),
      audioUrl: pickAudio(any),
      durationSec: parseDuration(any.itunesDuration),
      imageCandidate: pickImage(any),
      categories: Array.isArray(any.categories)
        ? any.categories
            .map((c: any) => (typeof c === 'string' ? c : c?._ ?? ''))
            .filter(Boolean)
        : [],
    });
  }
  return out;
}
