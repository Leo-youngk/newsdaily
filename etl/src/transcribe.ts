import './proxy.js';
import { config, assertCloudflareCreds } from './config.js';
import { hasFfmpeg, segmentsToHtml, transcribeAudio } from './whisper.js';
import { readingMinutes } from './util.js';
import * as store from './upload.js';
import type { Item, ItemDetail, TranscribeQueue, TranscribeTask } from './types.js';

/**
 * 转写工作流入口，与采集分开跑。
 *
 * 采集（etl）遇到没有现成文字稿的播客时只入队，不阻塞；
 * 这里按额度把队列消化掉，把正文写进 detail/ 并回填当日分片。
 *
 * 额度：Workers AI 免费层 10,000 neurons/天，whisper 计 46.63 neurons/音频分钟，
 * 即每天约 214 分钟。默认留出余量取 180 分钟。
 */
const MINUTE_BUDGET = parseInt(process.env.TRANSCRIBE_MINUTES ?? '180', 10);
const MAX_ATTEMPTS = 3;

async function loadQueue(): Promise<TranscribeQueue> {
  return (await store.readQueue()) ?? { updatedAt: 0, tasks: [] };
}

/** 转写完成后把条目在它所属的日期分片里更新掉 */
async function patchShard(task: TranscribeTask, contentLen: number, minutes: number): Promise<void> {
  const items = await store.readItems(task.date);
  if (!items.length) return;
  let touched = false;
  const next = items.map((it: Item) => {
    if (it.id !== task.id) return it;
    touched = true;
    return {
      ...it,
      contentLen,
      contentSource: 'transcript-whisper' as const,
      readingMinutes: minutes,
    };
  });
  if (touched) await store.writeItems(task.date, next);
}

async function main(): Promise<void> {
  assertCloudflareCreds();

  if (!(await hasFfmpeg())) {
    console.error('[fatal] 需要 ffmpeg，请在 runner 上先安装');
    process.exit(1);
  }

  const queue = await loadQueue();
  const pending = queue.tasks.filter((t) => t.attempts < MAX_ATTEMPTS);
  console.log(`[start] 队列 ${queue.tasks.length} 条，可处理 ${pending.length} 条，额度 ${MINUTE_BUDGET} 分钟`);
  if (!pending.length) {
    console.log('[done] 队列为空');
    return;
  }

  // 老的先转，避免新剧集一直插队把旧的饿死
  pending.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  let usedMinutes = 0;
  const done = new Set<string>();
  const startedAt = Date.now();

  for (const task of pending) {
    const est = Math.ceil((task.durationSec ?? 3600) / 60);
    if (usedMinutes + est > MINUTE_BUDGET) {
      console.log(`[skip] 额度不足（已用 ${usedMinutes}，本条约 ${est} 分钟），留到下一轮：${task.title.slice(0, 40)}`);
      continue;
    }

    console.log(`[run] ${task.sourceName} · ${task.title.slice(0, 50)}（约 ${est} 分钟）`);
    try {
      const t = await transcribeAudio(task.audioUrl, task.lang);
      const html = segmentsToHtml(t, task.lang);
      const minutes = readingMinutes(t.text, task.lang);

      const detail: ItemDetail = {
        id: task.id,
        title: task.title,
        url: task.url,
        sourceId: task.sourceId,
        sourceName: task.sourceName,
        contentHtml: html,
        contentText: t.text,
        contentSource: 'transcript-whisper',
        extractedAt: Date.now(),
      };
      await store.writeDetail(detail);
      await patchShard(task, t.text.length, minutes);

      usedMinutes += t.audioMinutes;
      done.add(task.id);
      console.log(
        `[ok] ${t.text.length} 字 / 阅读约 ${minutes} 分钟 / 音频 ${t.audioMinutes} 分钟，累计用量 ${usedMinutes}/${MINUTE_BUDGET}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      task.attempts += 1;
      task.lastError = msg;
      console.warn(`[fail] ${task.title.slice(0, 40)}：${msg}`);
    }
  }

  // 成功的移出队列；失败次数用尽的也移出，避免反复烧额度
  const remaining = queue.tasks.filter((t) => !done.has(t.id) && t.attempts < MAX_ATTEMPTS);
  const dropped = queue.tasks.length - remaining.length - done.size;
  await store.writeQueue({ updatedAt: Date.now(), tasks: remaining });

  console.log(
    `[done] 转写 ${done.size} 条，放弃 ${dropped} 条，剩余 ${remaining.length} 条，` +
      `用量 ${usedMinutes} 分钟，用时 ${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
  );
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
