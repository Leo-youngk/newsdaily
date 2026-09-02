import { fetchText } from './fetch.js';
import { config } from './config.js';

/**
 * Google News RSS 的 link 形如：
 *   https://news.google.com/rss/articles/CBMi....?oc=5
 *   https://news.google.com/rss/articles/AU_yqL....?oc=5
 * 需要解包出真实原文 URL。策略（best-effort）：
 *   1. CBMi 前缀：base64url 解码 protobuf，正则提取内嵌 http(s) URL
 *   2. 其余：抓取文章页 HTML，从 <c-wiz data-p> / <a href> / og:url 提取
 *   3. 全部失败：返回原链接（调用方会标记 unresolved）
 */

const GOOGLE_HOSTS = /(news\.google\.com|google\.[a-z.]+|gstatic\.com|googleapis\.com|schema\.org|w3\.org)/i;

function isGoogleNewsArticle(url: string): boolean {
  return /news\.google\.com\/rss\/articles\//i.test(url);
}

function extractArticleId(url: string): string | null {
  const m = url.match(/\/articles\/([^?/]+)/);
  return m ? m[1] : null;
}

function decodeBase64UrlProto(id: string): string | null {
  if (!id.startsWith('CBMi') && !id.startsWith('CBMih')) return null;
  try {
    const b64 = id.replace(/-/g, '+').replace(/_/g, '/');
    const buf = Buffer.from(b64, 'base64');
    const latin = buf.toString('latin1');
    const m = latin.match(/https?:\/\/[^\s"'<>\\]+/);
    if (m) {
      // 去掉 protobuf 尾部可能粘连的控制字符
      return m[0].replace(/[^\x20-\x7e].*$/, '');
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function decodeViaHtml(url: string): Promise<string | null> {
  try {
    const html = await fetchText(url, {
      timeout: config.ogTimeout,
      retries: 0,
      headers: { Cookie: 'CONSENT=YES+cb; SOCS=CAI' },
    });
    // og:url
    const og = html.match(
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    );
    if (og && !GOOGLE_HOSTS.test(og[1])) return og[1];
    // <a href="http..."> 非 google 域
    const anchors = html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi);
    for (const a of anchors) {
      const href = a[1];
      if (!GOOGLE_HOSTS.test(href) && !/accounts\.google|support\.google/.test(href)) {
        return href;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export interface UnpackedLink {
  url: string;
  resolved: boolean;
}

/** 解包单个 Google News 链接；非 gnews 链接原样返回 resolved=true */
export async function unpackGoogleNewsUrl(link: string): Promise<UnpackedLink> {
  if (!isGoogleNewsArticle(link)) return { url: link, resolved: true };

  const id = extractArticleId(link);
  if (id) {
    const fromProto = decodeBase64UrlProto(id);
    if (fromProto) return { url: fromProto, resolved: true };
  }
  const fromHtml = await decodeViaHtml(link);
  if (fromHtml) return { url: fromHtml, resolved: true };
  return { url: link, resolved: false };
}
