import { config } from './config.js';

const API = 'https://api.cloudflare.com/client/v4';

function encodeKey(key: string): string {
  // 保留 '/'，转义其余字符
  return key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function baseUrl(): string {
  return `${API}/accounts/${config.accountId}/r2/buckets/${config.bucket}`;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    ...extra,
  };
}

async function ensureOk(res: Response, ctx: string): Promise<Response> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`R2 ${ctx} 失败 ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

export interface R2ListResult {
  key: string;
  size: number;
  uploaded: string;
  etag?: string;
}

/** 读取对象文本，不存在返回 null */
export async function getObjectText(key: string): Promise<string | null> {
  const res = await fetch(`${baseUrl()}/objects/${encodeKey(key)}`, {
    method: 'GET',
    headers: headers(),
  });
  if (res.status === 404) return null;
  await ensureOk(res, `GET ${key}`);
  return await res.text();
}

export async function getObjectJson<T>(key: string): Promise<T | null> {
  const text = await getObjectText(key);
  if (text == null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** 读取对象二进制，不存在返回 null */
export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  const res = await fetch(`${baseUrl()}/objects/${encodeKey(key)}`, {
    method: 'GET',
    headers: headers(),
  });
  if (res.status === 404) return null;
  await ensureOk(res, `GET ${key}`);
  return Buffer.from(await res.arrayBuffer());
}

/** HEAD 判断对象是否存在 */
export async function objectExists(key: string): Promise<boolean> {
  const res = await fetch(`${baseUrl()}/objects/${encodeKey(key)}`, {
    method: 'HEAD',
    headers: headers(),
  });
  if (res.status === 404) return false;
  return res.ok;
}

export async function putObjectText(
  key: string,
  body: string,
  contentType = 'application/json; charset=utf-8',
): Promise<void> {
  const res = await fetch(`${baseUrl()}/objects/${encodeKey(key)}`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': contentType }),
    body,
  });
  await ensureOk(res, `PUT ${key}`);
}

export async function putObjectBuffer(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const res = await fetch(`${baseUrl()}/objects/${encodeKey(key)}`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': contentType }),
    body: new Uint8Array(body),
  });
  await ensureOk(res, `PUT ${key}`);
}

export async function deleteObject(key: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/objects/${encodeKey(key)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (res.status === 404) return;
  await ensureOk(res, `DELETE ${key}`);
}

/** 列举指定前缀下的对象（自动翻页） */
export async function listObjects(
  prefix: string,
  max = 5000,
): Promise<R2ListResult[]> {
  const out: R2ListResult[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ per_page: '1000', prefix });
    if (cursor) params.set('cursor', cursor);
    const res = await fetch(`${baseUrl()}/objects?${params.toString()}`, {
      method: 'GET',
      headers: headers(),
    });
    await ensureOk(res, `LIST ${prefix}`);
    const json = (await res.json()) as {
      success: boolean;
      result: Array<{ key: string; size: number; uploaded: string; etag?: string }>;
      result_info?: { cursor?: string };
    };
    for (const o of json.result ?? []) {
      out.push({ key: o.key, size: o.size, uploaded: o.uploaded, etag: o.etag });
    }
    cursor = json.result_info?.cursor;
  } while (cursor && out.length < max);
  return out;
}
