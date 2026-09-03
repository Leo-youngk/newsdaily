import { parseHTML } from 'linkedom';
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
 *
 * selector 是给"正文在页面里但通用算法挑错容器"的站点用的逃生口。
 * 实测踩到两个：Acquired 的单集页里逐字稿有 26 万字，Defuddle 只挑出
 * 2 千字的章节目录；Invest Like the Best 同理，只拿到 shownotes。
 * 这类站点结构稳定，写死一个选择器比放弃整个源划算。
 */
export async function extractFromUrl(
  url: string,
  selector?: string,
): Promise<Extracted | null> {
  let pageHtml: string;
  try {
    pageHtml = await fetchText(url, { timeout: config.sourceTimeout, retries: 0 });
  } catch {
    return null;
  }
  return extractFromHtml(pageHtml, url, selector);
}

export async function extractFromHtml(
  pageHtml: string,
  url: string,
  selector?: string,
): Promise<Extracted | null> {
  if (selector) {
    const picked = pickBySelector(pageHtml, url, selector);
    if (picked) return { ...picked, pageHtml };
    // 选择器失效要看得见：站点改版了，配置得跟着改，不能默默退回通用算法
    console.warn(`  [extract] 选择器 ${selector} 没匹配到内容，退回通用提取：${url}`);
  }
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

/** 按选择器取正文；匹配不到或内容太短返回 null，由调用方决定要不要降级 */
function pickBySelector(
  pageHtml: string,
  url: string,
  selector: string,
): { html: string; text: string; title?: string } | null {
  try {
    const { document } = parseHTML(pageHtml);
    // 同一个选择器可能命中多个块（分章节的文稿页），全部拼起来
    const nodes = Array.from(document.querySelectorAll(selector));
    if (!nodes.length) return null;
    const raw = nodes.map((n: any) => n.innerHTML ?? '').join('\n');
    const { html, text } = cleanContentHtml(raw, url);
    if (!text.length) return null;
    return { html, text, title: document.querySelector('title')?.textContent ?? undefined };
  } catch {
    return null;
  }
}
