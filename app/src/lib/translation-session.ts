import { get, set } from 'idb-keyval';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createJob, readJob, runJob, type ParagraphResult, type TranslationJob } from './ai';
import type { ReaderDocument } from './reader-document';

interface Snapshot {
  requested: boolean;
  jobId?: string;
  results: Record<string, ParagraphResult>;
  running: boolean;
  complete: boolean;
  message: string | null;
  warning: string | null;
}
const empty: Snapshot = { requested: false, results: {}, running: false, complete: false, message: null, warning: null };
const sessions = new Map<string, TranslationSession>();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class TranslationSession {
  state: Snapshot = empty;
  listeners = new Set<() => void>();
  pumping = false;
  ready: Promise<void>;
  constructor(readonly articleId: string, readonly doc: ReaderDocument, readonly key: string) {
    this.ready = this.restore();
  }
  emit(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((notify) => notify());
  }
  subscribe = (notify: () => void) => {
    this.listeners.add(notify);
    void this.ready.then(() => { if (this.state.requested) void this.pump(); });
    return () => { this.listeners.delete(notify); };
  };
  snapshot = () => this.state;
  async restore() {
    try {
      const saved = await get<Snapshot>(this.key);
      if (saved) this.emit({ ...saved, running: false });
    } catch (err) {
      console.warn('[translation] local read failed', err);
      this.emit({ warning: '本机译文缓存暂不可用，将从云端恢复' });
    }
  }
  async persist() {
    try { await set(this.key, { ...this.state, running: false }); }
    catch (err) {
      console.warn('[translation] local write failed', err);
      this.emit({ warning: this.state.jobId ? '本机未能保存译文，云端任务仍会继续' : '本机未能保存任务，请保持页面打开直到上传成功' });
    }
  }
  async accept(job: TranslationJob) {
    const results = { ...this.state.results };
    for (const unit of this.doc.units) if (job.results[unit.key]?.text) results[unit.key] = job.results[unit.key];
    const complete = this.doc.units.every((unit) => !!results[unit.key]?.text);
    this.emit({
      jobId: job.id, results, complete, running: !complete,
      message: complete ? null : job.retrying ? '暂时不可用的段落会自动补译，云端任务会继续运行' : '正在翻译，关闭页面后云端仍会继续',
      warning: job.warnings.length ? job.warnings.join('；') : this.state.warning,
    });
    await this.persist();
  }
  start = async () => {
    await this.ready;
    this.emit({ requested: true });
    await this.persist();
    void this.pump();
  };
  async pump() {
    if (this.pumping || this.state.complete || !this.state.requested || !this.listeners.size) return;
    this.pumping = true;
    let failures = 0;
    try {
      while (this.listeners.size && !this.state.complete) {
        try {
          this.emit({ running: true });
          let job = this.state.jobId ? await readJob(this.state.jobId) : await createJob(this.articleId, this.doc.units);
          await this.accept(job);
          if (this.state.complete) break;
          if (job.nextAttempt <= Date.now()) {
            job = await runJob(job.id);
            await this.accept(job);
          }
          failures = 0;
          if (!this.state.complete) await pause(job.busy ? 5000 : Math.min(15000, Math.max(1000, job.nextAttempt - Date.now())));
        } catch (err) {
          failures++;
          this.emit({ message: `${err instanceof Error ? err.message : String(err)}。保留当前结果，连接恢复后自动继续`, running: false });
          await this.persist();
          await pause(Math.min(30000, 2000 * 2 ** Math.min(failures - 1, 4)));
        }
      }
    } finally { this.pumping = false; }
  }
}
const noopSubscribe = () => () => {};
const emptySnapshot = () => empty;
export function useTranslation(articleId: string, doc: ReaderDocument | null) {
  const session = useMemo(() => {
    if (!doc?.units.length) return null;
    const key = `translation:${articleId}:${doc.revision}`;
    let session = sessions.get(key);
    if (!session) {
      session = new TranslationSession(articleId, doc, key);
      sessions.set(key, session);
      if (sessions.size > 20) for (const [oldKey, old] of sessions) {
        if (old !== session && !old.listeners.size && !old.pumping) { sessions.delete(oldKey); break; }
      }
    }
    return session;
  }, [articleId, doc]);
  const state = useSyncExternalStore(session?.subscribe ?? noopSubscribe, session?.snapshot ?? emptySnapshot);
  useEffect(() => {
    const onOnline = () => { if (session?.state.requested) void session.pump(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [session]);
  return { ...state, start: session?.start ?? (async () => {}), completed: Object.values(state.results).filter((r) => r.text).length, total: doc?.units.length ?? 0 };
}
