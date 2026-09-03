// Worker API 客户端：所有数据与图片均通过 Worker（同源 /data/*），避免 CORS 与防盗链

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ||
  'https://news-pwa-worker.if5v.workers.dev';
let configEtag: string | null = null;

/** 把 Item.image（形如 /data/img/x.webp）解析为绝对 URL */
export function resolveImage(image?: string): string | undefined {
  if (!image) return undefined;
  if (/^https?:\/\//i.test(image)) return image;
  return API_BASE + (image.startsWith('/') ? image : '/' + image);
}

async function getJson<T>(path: string, cache: RequestCache = 'default'): Promise<T> {
  // 重试一次：用户多半在代理后面访问 workers.dev，网络抖一下就前功尽弃。
  // 一次性失败会让阅读页直接显示"正文取不到"，而内容其实一直在服务器上。
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { cache, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
      if (path === '/api/config') configEtag = res.headers.get('ETag');
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (i === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

export const dataApi = {
  index: () => getJson<import('../types').LatestIndex>('/data/index/latest.json', 'no-cache'),
  items: (date: string) =>
    getJson<{ date: string; items: import('../types').Item[] }>(
      `/data/items/${date}.json`,
      'no-cache',
    ),
  detail: (id: string) =>
    getJson<import('../types').ItemDetail>(`/data/detail/${id}.json`),
  config: () => getJson<import('../types').AppConfig>('/api/config', 'no-store'),
};

export async function putConfig(
  cfg: import('../types').AppConfig,
  adminToken: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
      ...(configEtag ? { 'If-Match': configEtag } : {}),
    },
    body: JSON.stringify(cfg),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`保存配置失败 HTTP ${res.status}: ${t.slice(0, 120)}`);
  }
  configEtag = res.headers.get('ETag');
}
