import { fetchText } from './fetch.js';
import { config } from './config.js';
import { stripHtml } from './util.js';
import type { ItemDetail } from './types.js';

/**
 * 正文提取：@mozilla/readability + linkedom（Node 环境提供 DOM 实现）。
 * 仅对 kind=deep 且源开启 offlineReading 的条目执行。
 */
export async function extractContent(
  id: string,
  url: string,
  title: string,
  sourceId: string,
  sourceName: string,
): Promise<ItemDetail | null> {
  try {
    const html = await fetchText(url, {
      timeout: config.sourceTimeout,
      retries: 0,
    });
    const { parseHTML } = await import('linkedom');
    const { Readability } = await import('@mozilla/readability');
    const doc = parseHTML(html).document as unknown as Document;
    const reader = new Readability(doc, { charThreshold: 200 });
    const article = reader.parse();
    if (!article || !article.content) return null;
    const contentText = stripHtml(article.content);
    if (contentText.length < 120) return null; // 太短视为提取失败
    return {
      id,
      title: (article.title || title).trim(),
      url,
      sourceId,
      sourceName,
      contentHtml: article.content,
      contentText,
      extractedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
