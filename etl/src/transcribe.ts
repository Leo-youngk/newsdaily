import './proxy.js';
import { config, assertCloudflareCreds } from './config.js';
import { QuotaExceededError, normalizeZhTranscript, segmentsToHtml } from './whisper.js';
import { readingMinutes } from './util.js';
import * as store from './upload.js';
import type { Item, ItemDetail, TranscribeQueue } from './types.js';

/**
 * 转写工作流入口，与采集分开跑。
 *
 * 采集（etl）遇到没有现成文字稿的播客时只入队，不阻塞；
 * 这里按额度把队列消化掉，把正文写进 detail/ 并回填当日分片。
 *
 * 额度必须按天算，不能只按单次运行算：
 * Workers AI 免费层 10,000 neurons/天，whisper 计 46.63 neurons/音频分钟
 * → 每天 214 分钟。而 cron 一天跑 4 次，只限制单次预算的话
 * 4 × 180 = 720 分钟/天，会直接跑出免费额度开始计费。
 * 当日用量记在队列文件里，按 UTC 日期跨天归零。
 *
 * 后端三选一，TRANSCRIBE_BACKEND：
 *   cf（默认）  Workers AI，免费但每天只有 214 分钟且重置时间不可靠
 *   local       本机 GPU，无上限但要求机器开着
 *   openrouter  按量付费，跑在 Actions 上，关机也照转
 * 只有 cf 这条路要记额度：另外两条不消耗 Workers AI，因此不做每日上限、
 * 也不读写 usage/blockedUntil —— 那两个字段是 Cloudflare 那条路的账，
 * 必须原样带回去，抹掉等于把每日上限清零，这个坑已经踩过一次。
 */
const BACKENDS = { cf: './whisper.js', local: './whisper-local.js', openrouter: './whisper-openrouter.js' } as const;
type Backend = keyof typeof BACKENDS;
const BACKEND: Backend = (process.env.TRANSCRIBE_BACKEND ?? 'cf') in BACKENDS
  ? ((process.env.TRANSCRIBE_BACKEND ?? 'cf') as Backend)
  : 'cf';
/** 只有 Workers AI 这条路要限额度记账 */
const CF = BACKEND === 'cf';
const DAILY_CAP = parseInt(process.env.TRANSCRIBE_DAILY_CAP ?? '200', 10);
/**
 * 单次运行的音频分钟上限。
 * local 是自家显卡，跑多久都不花钱，所以不设实际上限；
 * cf 和 openrouter 都要卡住：前者是免费额度，后者是真金白银
 * （whisper-1 $0.006/分钟，90 分钟约 $0.54，一天四次封顶约 $2）。
 */
const RUN_BUDGET = parseInt(process.env.TRANSCRIBE_MINUTES ?? (BACKEND === 'local' ? '100000' : '90'), 10);
/** whisper-1 的实际单价，只用来在日志里把花销说明白 */
const USD_PER_MIN = 0.006;
const MAX_ATTEMPTS = 3;
/** 撞到额度后等多久再试。比 cron 间隔略短，保证每次定时都会真的探一下 */
const QUOTA_BACKOFF_MS = 3 * 60 * 60 * 1000;

function utcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

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

  const backend = await import(BACKENDS[BACKEND]);
  const envErr = await backend.checkEnv();
  if (envErr) {
    console.error(`[fatal] ${BACKEND} 后端不可用：${envErr}`);
    process.exit(1);
  }

  const queue = await loadQueue();
  const today = utcDate();
  const usedToday = queue.usage?.utcDate === today ? queue.usage.minutes : 0;
  const budget = CF ? Math.max(0, Math.min(RUN_BUDGET, DAILY_CAP - usedToday)) : RUN_BUDGET;

  const pending = queue.tasks.filter((t) => t.attempts < MAX_ATTEMPTS);
  console.log(
    `[start] 后端 ${BACKEND} | 队列 ${queue.tasks.length} 条，可处理 ${pending.length} 条 | ` +
      (CF
        ? `本次额度 ${budget} 分钟（单次上限 ${RUN_BUDGET}，今日已用 ${usedToday}/${DAILY_CAP}）`
        : BACKEND === 'openrouter'
          ? `本次上限 ${budget} 分钟（最多花 $${(budget * USD_PER_MIN).toFixed(2)}）`
          : `本次上限 ${budget} 分钟（本地跑，不花钱）`),
  );
  if (!pending.length) {
    console.log('[done] 队列为空');
    return;
  }
  if (CF && queue.blockedUntil && Date.now() < queue.blockedUntil) {
    const mins = Math.ceil((queue.blockedUntil - Date.now()) / 60000);
    console.log(`[done] 上次撞到 Workers AI 额度，还需退避 ${mins} 分钟`);
    return;
  }
  if (budget <= 0) {
    console.log(`[done] 今日额度已用尽（${usedToday}/${DAILY_CAP} 分钟），留到明天`);
    return;
  }

  // 老的先转，避免新剧集一直插队把旧的饿死
  pending.sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  let usedMinutes = 0;
  let quotaHit = false;
  const done = new Set<string>();
  const completed: Completed[] = [];
  const startedAt = Date.now();

  for (const task of pending) {
    const est = Math.ceil((task.durationSec ?? 3600) / 60);
    if (usedMinutes + est > budget) {
      console.log(`[skip] 额度不足（本次已用 ${usedMinutes}/${budget}，本条约 ${est} 分钟），留到下一轮：${task.title.slice(0, 40)}`);
      continue;
    }

    console.log(`[run] ${task.sourceName} · ${task.title.slice(0, 50)}（约 ${est} 分钟）`);
    try {
      const raw = await backend.transcribeAudio(task.audioUrl, task.lang);
      // 两个后端都过一遍：whisper 的中文输出半角全角混用，不规范化读起来很脏
      const t = task.lang === 'zh' ? normalizeZhTranscript(raw) : raw;
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
        `[ok] ${t.text.length} 字 / 阅读约 ${minutes} 分钟 / 音频 ${t.audioMinutes} 分钟，` +
          (CF ? `本次 ${usedMinutes}/${budget}，今日 ${usedToday + usedMinutes}/${DAILY_CAP}` : `本次累计 ${usedMinutes} 分钟`),
      );
    } catch (err) {
      // 额度耗尽不是这条任务的问题：立刻收工，不累加 attempts，
      // 否则一次配额用尽会把队列里所有任务的重试次数一起消耗掉
      if (err instanceof QuotaExceededError) {
        quotaHit = true;
        console.warn(`[quota] ${err.message.slice(0, 120)}`);
        console.warn(
          `[quota] 本次提前结束，${QUOTA_BACKOFF_MS / 3600000} 小时后再探`,
        );
        break;
      }
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
  await store.writeQueue({
    updatedAt: Date.now(),
    tasks: remaining,
    // local / openrouter 不烧 Workers AI 额度，原样带回 Cloudflare 那条路的账；
    // 抹掉它等于把每日上限清零，这个坑已经踩过一次
    usage: CF ? { utcDate: today, minutes: usedToday + usedMinutes } : queue.usage,
    // 撞到 429 就退避一段时间再试，而不是把整天判死：
    // Cloudflare 的重置时间实测不可靠，额度什么时候回来只能探
    blockedUntil: CF ? (quotaHit ? Date.now() + QUOTA_BACKOFF_MS : undefined) : queue.blockedUntil,
  });

  console.log(
    `[done] 转写 ${done.size} 条，放弃 ${dropped} 条，剩余 ${remaining.length} 条，` +
      `本次 ${usedMinutes} 分钟音频，` +
      (CF ? `今日累计 ${usedToday + usedMinutes}/${DAILY_CAP}，` : '') +
      (BACKEND === 'openrouter' ? `本次花费约 $${(usedMinutes * USD_PER_MIN).toFixed(2)}，` : '') +
      `用时 ${((Date.now() - startedAt) / 1000).toFixed(0)}s`,
  );
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
