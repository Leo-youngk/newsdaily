import { API_BASE } from './api';
import { prefs } from './prefs';
import type { TranslationUnit } from './reader-document';

export interface AiResult {
  text?: string;
  cached?: boolean;
  model?: string;
  fallback?: boolean;
  warning?: string;
  error?: string;
}

export interface ParagraphResult {
  key: string;
  text?: string;
  model?: string;
  cacheSaved?: boolean;
  error?: string;
}

export interface TranslationJob {
  id: string;
  state: 'pending' | 'complete';
  completed: number;
  total: number;
  results: Record<string, ParagraphResult>;
  warnings: string[];
  nextAttempt: number;
  retrying: number;
  busy?: boolean;
}

export async function aiRequest<T>(path: string, body?: unknown): Promise<T> {
  const token = prefs.getAdminToken();
  if (!token) throw new Error('请先在设置中保存管理令牌');
  const res = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(125000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `服务暂不可用（HTTP ${res.status}）`);
  return json;
}

async function textRequest(path: string, body: unknown): Promise<AiResult> {
  try {
    return await aiRequest<AiResult>(path, body);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export const summarize = (id: string) => textRequest('/api/ai/summary', { id });
export const translateTitle = (id: string, title: string) =>
  textRequest('/api/ai/translate', { id, text: title, field: 'title' });
export const translateBody = (id: string) =>
  textRequest('/api/ai/translate', { id, field: 'body' });

export async function getBilingual(id: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/ai/bilingual?id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { cached?: boolean; translations?: string[] };
    return json.cached && Array.isArray(json.translations) ? json.translations : null;
  } catch {
    return null;
  }
}

export async function saveBilingual(id: string, translations: string[]): Promise<void> {
  const token = prefs.getAdminToken();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/api/ai/bilingual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ id, translations }),
    });
  } catch {
    // 忽略缓存保存失败
  }
}

export async function translateBatch(
  id: string,
  paragraphs: string[],
): Promise<{ translations: string[]; warnings?: string[] }> {
  const token = prefs.getAdminToken();
  if (!token) throw new Error('请先在设置中保存管理令牌');
  const res = await fetch(`${API_BASE}/api/ai/translate-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ id, paragraphs }),
  });
  const json = (await res.json()) as {
    translations?: string[];
    warnings?: string[];
    error?: string;
  };
  if (!res.ok || !json.translations) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return { translations: json.translations, warnings: json.warnings };
}

/**
 * 批量逐段翻译调度器：分批切片（每批 15 段），并发度为 2，
 * 每次译好一批即调用 onBatchDone 回传，全部完成时自动持久化到云端。
 */
export async function translateParagraphsInBatches(
  id: string,
  paragraphs: string[],
  onBatchDone: (
    startIndex: number,
    chunk: string[],
    completedCount: number,
    warnings?: string[],
  ) => void,
  batchSize = 15,
  concurrency = 2,
): Promise<string[]> {
  const results: string[] = new Array(paragraphs.length).fill('');
  const chunks: Array<{ start: number; items: string[] }> = [];

  for (let i = 0; i < paragraphs.length; i += batchSize) {
    chunks.push({
      start: i,
      items: paragraphs.slice(i, i + batchSize),
    });
  }

  let completed = 0;
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < chunks.length) {
      const idx = cursor++;
      const { start, items } = chunks[idx];
      const batchRes = await translateBatch(id, items);
      const translated = batchRes.translations;
      for (let j = 0; j < translated.length; j++) {
        results[start + j] = translated[j];
      }
      completed += items.length;
      onBatchDone(start, translated, Math.min(completed, paragraphs.length), batchRes.warnings);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => runWorker());
  await Promise.all(workers);

  // 异步缓存到后端 R2，不阻塞前端
  void saveBilingual(id, results);

  return results;
}

export const createJob = (articleId: string, paragraphs: TranslationUnit[]) =>
  aiRequest<TranslationJob>('/api/ai/jobs', { articleId, paragraphs });
export const readJob = (id: string) => aiRequest<TranslationJob>(`/api/ai/jobs/${id}`);
export const runJob = (id: string) => aiRequest<TranslationJob>(`/api/ai/jobs/${id}/run`, {});
