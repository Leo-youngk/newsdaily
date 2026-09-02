import './proxy.js';
import { config, assertCloudflareCreds } from './config.js';
import { hasFfmpeg, segmentsToHtml, transcribeAudio } from './whisper.js';
import { readingMinutes } from './util.js';
import * as store from './upload.js';
import type { Item, ItemDetail, TranscribeQueue } from './types.js';

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

interface Completed {
  id: string;
  date: string;
  contentLen: number;
  minutes: number;
}

/**
 * 把转写结果批量回填到日期分片。
 *
 * 必须批量：原来每转完一条就对同一个分片对象做一次 read-modify-write，
 * 实测两条连续转写只有一条落库——另一条的正文躺在 detail/ 里，
 * 条目却永远显示"转写中"。改为按日期分组，一次读、一次写。
 *
 * 同时做对账：分片里凡是还标着 pending-transcript、但 detail 已经存在的，
 * 一并修好。这样历史上漏掉的回填会在下一次运行自动愈合。
 */
async function patchShards(completed: Completed[]): Promise<void> {
  const byDate = new Map<string, Completed[]>();
  for (const c of completed) {
    const arr = byDate.get(c.date) ?? [];
    arr.push(c);
    byDate.set(c.date, arr);
  }

  // 对账范围要覆盖所有出现过 pending 的分片，不只是本轮转写的
  const queue = await loadQueue();
  for (const t of queue.tasks) if (!byDate.has(t.date)) byDate.set(t.date, []);

  for (const [date, list] of byDate) {
    const items = await store.readItems(date);
    if (!items.length) {
      console.warn(`[warn] 分片 items/${date}.json 读不到，跳过回填`);
      continue;
    }
    const done = new Map(list.map((c) => [c.id, c]));
    let patched = 0;
    let healed = 0;

    const next: Item[] = [];
    for (const it of items) {
      const c = done.get(it.id);
      if (c) {
        patched++;
        next.push({
          ...it,
          contentLen: c.contentLen,
          contentSource: 'transcript-whisper',
          readingMinutes: c.minutes,
        });
        continue;
      }
      // 对账：标着待转写但 detail 已存在的，说明上一轮回填漏了
      if (it.contentSource === 'pending-transcript') {
        const d = await store.readDetail(it.id);
        if (d?.contentText) {
          healed++;
          next.push({
            ...it,
            contentLen: d.contentText.length,
            contentSource: 'transcript-whisper',
            readingMinutes: readingMinutes(d.contentText, it.lang),
          });
          continue;
        }
      }
      next.push(it);
    }

    if (patched || healed) {
      await store.writeItems(date, next);
      console.log(
        `[patch] ${date}：回填 ${patched} 条${healed ? `，对账修复 ${healed} 条` : ''}`,
      );
    }
  }
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
  const completed: Completed[] = [];
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
      completed.push({ id: task.id, date: task.date, contentLen: t.text.length, minutes });

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

  // 先批量回填（含对账），再更新队列
  await patchShards(completed);

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
