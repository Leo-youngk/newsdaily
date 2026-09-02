// AI 前端客户端：调用 Worker /api/ai/*，结果由 Worker 侧 D1 缓存

import { API_BASE } from './api';

export interface AiResult {
  text?: string;
  cached?: boolean;
  model?: string;
  error?: string;
}

async function post(path: string, body: unknown): Promise<AiResult> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as AiResult;
    if (!res.ok) return { error: json.error || `HTTP ${res.status}` };
    return json;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function summarize(id: string, text: string): Promise<AiResult> {
  return post('/api/ai/summary', { id, text });
}

export function translate(
  id: string,
  text: string,
  field: 'title' | 'body' = 'body',
): Promise<AiResult> {
  return post('/api/ai/translate', { id, text, field });
}
