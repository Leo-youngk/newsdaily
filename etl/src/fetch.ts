import { randomUA, sleep } from './util.js';

export interface FetchOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  redirect?: RequestRedirect;
}

async function withTimeout(
  url: string,
  init: RequestInit,
  timeout: number,
): Promise<Response> {
  // signal 必须活到响应体消费完；收到响应头不能撤销超时。
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
}

/** 带重试与随机 UA 的抓取，返回 Response（调用方决定如何消费） */
export async function fetchUrl(
  url: string,
  opts: FetchOptions = {},
): Promise<Response> {
  const timeout = opts.timeout ?? 15000;
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await withTimeout(
        url,
        {
          headers: {
            'User-Agent': randomUA(),
            Accept:
              'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            ...opts.headers,
          },
          redirect: opts.redirect ?? 'follow',
        },
        timeout,
      );
      if (res.ok) return res;
      lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
      // 4xx（除 429）没有重试价值，直接放弃。
      // 注意不能在这里 throw：外层 catch 会把它接住，反而变成继续重试。
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw lastErr;
      }
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : '';
      if (/^HTTP 4(?!29)/.test(msg)) break;
    }
    if (attempt < retries) await sleep(600 * (attempt + 1));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchText(url: string, opts?: FetchOptions): Promise<string> {
  const res = await fetchUrl(url, opts);
  return await res.text();
}

export async function fetchBuffer(
  url: string,
  opts?: FetchOptions,
): Promise<{ buf: Buffer; contentType: string }> {
  const res = await fetchUrl(url, opts);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, contentType: res.headers.get('content-type') ?? '' };
}
