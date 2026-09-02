// Worker API 客户端：所有数据与图片均通过 Worker（同源 /data/*），避免 CORS 与防盗链

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ||
  'https://news-pwa-worker.if5v.workers.dev';

/** 把 Item.image（形如 /data/img/x.webp）解析为绝对 URL */
export function resolveImage(image?: string): string | undefined {
  if (!image) return undefined;
  if (/^https?:\/\//i.test(image)) return image;
  return API_BASE + (image.startsWith('/') ? image : '/' + image);
}

async function getJson<T>(path: string, cache: RequestCache = 'default'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const dataApi = {
  index: () => getJson<import('../types').LatestIndex>('/data/index/latest.json'),
  items: (date: string) =>
    getJson<{ date: string; items: import('../types').Item[] }>(
      `/data/items/${date}.json`,
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
    },
    body: JSON.stringify(cfg),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`保存配置失败 HTTP ${res.status}: ${t.slice(0, 120)}`);
  }
}
