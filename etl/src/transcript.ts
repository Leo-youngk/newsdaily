import { fetchText } from './fetch.js';
import { config } from './config.js';
import { transcriptToHtml } from './html.js';
import { extractFromUrl } from './extract.js';
import type { TranscriptRule, ContentSource } from './types.js';
import type { TranscriptRef } from './parse.js';

export interface ResolvedTranscript {
  html: string;
  text: string;
  source: ContentSource;
  from: string; // 实际取到文稿的 URL，便于排查
}

/** 按规则从单集页 URL 推出文稿页 URL；规则不匹配返回 null */
export function deriveTranscriptUrl(
  pageUrl: string,
  rule?: TranscriptRule,
): string | null {
  if (!rule?.from || !rule?.to) return null;
  let re: RegExp;
  try {
    re = new RegExp(rule.from);
  } catch {
    return null;
  }
  if (!re.test(pageUrl)) return null;
  const out = pageUrl.replace(re, rule.to);
  return /^https?:\/\//i.test(out) ? out : null;
}

/**
 * 解析一集播客的逐字稿。两条路，按可靠度排序：
 *   1. feed 里的 <podcast:transcript> 直链（最干净，纯文本直接可用）
 *   2. 按 transcript.from/to 规则推出文稿页，再走正文提取
 * 都拿不到就返回 null，调用方降级为只保留 shownotes。
 */
export async function resolveTranscript(
  pageUrl: string,
  refs: TranscriptRef[],
  rule: TranscriptRule | undefined,
  minChars: number,
  selector?: string,
): Promise<ResolvedTranscript | null> {
  // 1) <podcast:transcript> 标签
  for (const ref of refs.slice(0, 2)) {
    try {
      const raw = await fetchText(ref.url, {
        timeout: config.sourceTimeout,
        retries: 0,
      });
      const { html, text } = transcriptToHtml(raw, ref.type, ref.url);
      if (text.length >= minChars) {
        return { html, text, source: 'transcript-tag', from: ref.url };
      }
    } catch {
      /* 试下一个 */
    }
  }

  // 2) 文稿页规则
  const derived = deriveTranscriptUrl(pageUrl, rule);
  if (derived) {
    const ex = await extractFromUrl(derived, selector);
    if (ex && ex.text.length >= minChars) {
      return { html: ex.html, text: ex.text, source: 'transcript-page', from: derived };
    }
  }

  return null;
}
