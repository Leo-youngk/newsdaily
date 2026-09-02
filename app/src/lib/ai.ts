// AI 客户端：调 Worker /api/ai/*，结果由 Worker 侧 D1 缓存。
// 正文不再从前端上传 —— Worker 自己按 id 从 R2 取，逐字稿动辄十几万字符，传不上去也不该传。

import { API_BASE } from './api';
import { prefs } from './prefs';

export interface AiResult {
  text?: string;
  cached?: boolean;
  model?: string;
  error?: string;
}

async function post(path: string, body: unknown): Promise<AiResult> {
  const token = prefs.getAdminToken();
  if (!token) {
    return { error: '需要先在设置里填写管理令牌才能使用 AI 功能' };
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as AiResult;
    if (!res.ok) return { error: json.error || `HTTP ${res.status}` };
    return json;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function summarize(id: string): Promise<AiResult> {
  return post('/api/ai/summary', { id });
}

export function translateBody(id: string): Promise<AiResult> {
  return post('/api/ai/translate', { id, field: 'body' });
}

export function translateTitle(id: string, title: string): Promise<AiResult> {
  return post('/api/ai/translate', { id, text: title, field: 'title' });
}
