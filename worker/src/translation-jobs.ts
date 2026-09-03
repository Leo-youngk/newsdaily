import type { AiEnv } from './ai.js';
import { translateParagraphBatch, type ParagraphInput, type ParagraphResult } from './translations.js';

export interface JobEnv extends AiEnv { NEWS_R2: R2Bucket; DB: D1Database }
interface Retry { count: number; at: number; error: string }
interface Job {
  paragraphs: ParagraphInput[];
  results: Record<string, ParagraphResult>;
  retries: Record<string, Retry>;
  warnings: string[];
}
const keyFor = (id: string) => `translation-jobs/${id}.json`;

async function readJob(env: JobEnv, id: string): Promise<Job | null> {
  const obj = await env.NEWS_R2.get(keyFor(id));
  return obj ? obj.json<Job>() : null;
}
async function writeJob(env: JobEnv, id: string, job: Job) {
  await env.NEWS_R2.put(keyFor(id), JSON.stringify(job), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}
function view(id: string, job: Job) {
  const missing = job.paragraphs.filter((p) => !job.results[p.key]?.text);
  const completed = job.paragraphs.length - missing.length;
  const nextAttempt = missing.length ? Math.min(...missing.map((p) => job.retries[p.key]?.at ?? 0)) : 0;
  return {
    id, state: missing.length ? 'pending' : 'complete', completed, total: job.paragraphs.length,
    results: job.results, warnings: job.warnings, nextAttempt,
    retrying: missing.filter((p) => job.retries[p.key]).length,
  };
}

export async function createTranslationJob(env: JobEnv, articleId: string, paragraphs: ParagraphInput[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(['v2', articleId, paragraphs])));
  const id = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  let job = await readJob(env, id);
  if (!job) {
    const initial: Job = { paragraphs, results: {}, retries: {}, warnings: [] };
    await env.NEWS_R2.put(keyFor(id), JSON.stringify(initial), {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
    job = await readJob(env, id);
    if (!job) throw new Error('翻译任务保存失败');
  }
  await env.DB.prepare('INSERT OR IGNORE INTO translation_jobs (id, updated_at) VALUES (?1, ?2)').bind(id, Date.now()).run();
  return view(id, job);
}

export async function getTranslationJob(env: JobEnv, id: string) {
  const job = await readJob(env, id);
  return job ? view(id, job) : null;
}

/** 重试时缩短段落；子段也按内容缓存，成功子段无需再次付费。 */
function splitForRetry(p: ParagraphInput): ParagraphInput[] {
  if (p.text.length <= 800) return [p];
  const out: ParagraphInput[] = [];
  let rest = p.text;
  while (rest.length) {
    let end = Math.min(800, rest.length);
    if (end < rest.length) {
      const space = rest.lastIndexOf(' ', end);
      if (space > 400) end = space;
    }
    out.push({ key: `${p.key}.${out.length}`, text: rest.slice(0, end).trim() });
    rest = rest.slice(end).trimStart();
  }
  return out;
}

export async function runTranslationJob(env: JobEnv, id: string) {
  const now = Date.now();
  // D1 原子领取，前台、多个标签页、定时任务不能同时生成同一任务。
  const claimed = await env.DB.prepare(
    "UPDATE translation_jobs SET lease_until = ?2 WHERE id = ?1 AND state != 'complete' AND next_attempt <= ?3 AND lease_until < ?3 RETURNING id",
  ).bind(id, now + 180000, now).first();
  if (!claimed) {
    const state = await getTranslationJob(env, id);
    return state ? { ...state, busy: true } : null;
  }
  try {
    const job = await readJob(env, id);
    if (!job) throw new Error('找不到翻译任务正文');
    const available = job.paragraphs.filter((p) => !job.results[p.key]?.text && (job.retries[p.key]?.at ?? 0) <= now);
    available.sort((a, b) => (job.retries[a.key]?.count ?? 0) - (job.retries[b.key]?.count ?? 0));
    const selected: ParagraphInput[] = [];
    const groups = new Map<string, ParagraphInput[]>();
    let chars = 0;
    for (const p of available) {
      const parts = (job.retries[p.key]?.count ?? 0) >= 2 ? splitForRetry(p) : [p];
      if (selected.length && (selected.length + parts.length > 15 || chars + p.text.length > 16000)) break;
      groups.set(p.key, parts);
      selected.push(...parts);
      chars += p.text.length;
    }
    if (selected.length) {
      const batch = await translateParagraphBatch(env, selected);
      job.warnings = [...new Set([...job.warnings, ...batch.warnings])].slice(-8);
      const byKey = new Map(batch.results.map((r) => [r.key, r]));
      for (const [key, parts] of groups) {
        const values = parts.map((p) => byKey.get(p.key));
        if (values.every((r) => !!r?.text)) {
          job.results[key] = {
            key, text: values.map((r) => r!.text).join(' '),
            model: [...new Set(values.map((r) => r!.model).filter(Boolean))].join(', '),
            cacheSaved: values.every((r) => r!.cacheSaved),
          };
          delete job.retries[key];
        } else {
          const count = (job.retries[key]?.count ?? 0) + 1;
          job.retries[key] = {
            count, at: Date.now() + Math.min(30, 2 ** Math.min(count - 1, 5)) * 60000,
            error: values.find((r) => r?.error)?.error || '译文不完整，等待自动补译',
          };
        }
      }
      await writeJob(env, id, job);
    }
    const state = view(id, job);
    await env.DB.prepare('UPDATE translation_jobs SET state=?2, next_attempt=?3, lease_until=0, updated_at=?4 WHERE id=?1')
      .bind(id, state.state === 'complete' ? 'complete' : 'queued', state.nextAttempt, Date.now()).run();
    return { ...state, busy: false };
  } catch (err) {
    console.error('[translation-job] suspended, will resume', { id, error: String(err) });
    await env.DB.prepare('UPDATE translation_jobs SET lease_until=0, next_attempt=?2, updated_at=?3 WHERE id=?1')
      .bind(id, Date.now() + 60000, Date.now()).run();
    throw err;
  }
}

export async function runDueTranslationJobs(env: JobEnv) {
  const now = Date.now();
  const rows = await env.DB.prepare("SELECT id FROM translation_jobs WHERE state != 'complete' AND next_attempt <= ?1 AND lease_until < ?1 ORDER BY updated_at LIMIT 4")
    .bind(now).all<{ id: string }>();
  await Promise.all(rows.results.map(async ({ id }) => {
    const deadline = Date.now() + 150000;
    try {
      do {
        const state = await runTranslationJob(env, id);
        if (!state || state.busy || state.state === 'complete' || state.nextAttempt > Date.now()) break;
      } while (Date.now() < deadline);
    } catch (err) { console.error('[translation-cron]', { id, error: String(err) }); }
  }));
}
