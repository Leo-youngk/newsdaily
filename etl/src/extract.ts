import { fetchText } from './fetch.js';
import { config } from './config.js';
import { cleanContentHtml } from './html.js';

export interface Extracted {
  html: string;
  text: string;
  title?: string;
  /** 抓回来的原始页面 HTML，供调用方复用（例如顺手取 og:image，避免同一页面抓两遍） */
  pageHtml: string;
}

/**
 * 正文提取：Defuddle + linkedom。
 * 用 Defuddle 而不是 @mozilla/readability —— 后者基本停止维护，
 * 实测在 This American Life 文稿页上 Readability 只拿到 2 万字符，Defuddle 拿到 6 万。
 */
export async function extractFromUrl(url: string): Promise<Extracted | null> {
  let pageHtml: string;
  try {
    pageHtml = await fetchText(url, { timeout: config.sourceTimeout, retries: 0 });
  } catch {
    return null;
  }
  return extractFromHtml(pageHtml, url);
}

export async function extractFromHtml(
  pageHtml: string,
  url: string,
): Promise<Extracted | null> {
  try {
    const { Defuddle } = await import('defuddle/node');
    const res: any = await Defuddle(pageHtml, url);
    const rawHtml: string = res?.content ?? '';
    if (!rawHtml) return { html: '', text: '', pageHtml };
    const { html, text } = cleanContentHtml(rawHtml, url);
    return { html, text, title: res?.title, pageHtml };
  } catch {
    return { html: '', text: '', pageHtml };
  }
}
