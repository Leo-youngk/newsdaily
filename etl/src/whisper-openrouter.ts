import { readFile } from 'node:fs/promises';
import { CHUNK_SECONDS, cleanup, downloadAndChunk, hasFfmpeg } from './audio.js';
import { QuotaExceededError, type Segment, type Transcription } from './whisper.js';

/**
 * OpenRouter 转写后端。
 *
 * 存在的理由：Workers AI 免费层每天只有 214 音频分钟且实测不按时重置，
 * 本地 GPU 又要求机器开着。OpenRouter 跑在 Actions 上，定时任务照常执行，
 * 跟用户的机器开不开机无关，代价是按量付费。
 *
 * 模型选 qwen3-asr-1.7b（$0.027/音频小时）。2026-09-03 拿硅谷101 E250
 * **访谈中段**的真实 5 分钟切片把 19 个候选全打了一遍，结果：
 *
 *   模型                        $/音频小时  中文标点    段时间戳   术语命中(满分68)
 *   qwen/qwen3-asr-1.7b           0.027    每 13 字    每 27 秒        58
 *   qwen/qwen3-asr-0.6b           0.012    每 14 字    每 27 秒        58
 *   openai/gpt-4o-mini-transcribe 0.129    每 15 字      无            58
 *   openai/gpt-transcribe         0.271    每 14 字      无            64
 *   microsoft/mai-transcribe-1.5  0.361    每 13 字      无            65
 *   openai/whisper-1              0.360    无，用空格   每 2 秒        68
 *   whisper-large-v3-turbo        0.012    完全没有     每 2 秒        —
 *   whisper-large-v3              0.027    完全没有     每 2 秒        —
 *   nvidia/nemotron-3.5-asr       0.012    每 18 字      —             25
 *   deepgram/nova-3 / voxtral     0.26/0.18  完全没有    —             50/62
 *
 * 术语命中 = 这 5 分钟里「莫德纳/mRNA/PD-1/新抗原/肿瘤疫苗…」被听对的次数。
 * qwen 输掉的那 10 分几乎全在专名（把「莫德纳」听成「我这俩」），
 * 但便宜 13 倍，而且给的是真标点而不是空格，读起来比 whisper-1 还顺。
 *
 * 三条反直觉的实测结论，别再重新试一遍：
 *
 * 1. 供应商钉不住。STT 的 provider 字段只有 options（按供应商透传参数），
 *    没有 order/only；写了 only 也是静默忽略。turbo 三次请求
 *    （裸跑 / only:groq / only:together）产出逐字节相同、计费都是
 *    最便宜那家的价。模型名后缀 `model@groq` 直接 400 "does not exist"。
 * 2. prompt 透传无效，加不加引导词输出完全一样。
 * 3. whisper 系转中文对话时一个标点都不给（跟模型、供应商、切片长度都无关，
 *    同一段音频切 300 秒和切 5×60 秒产出逐字节相同）。只有 OpenAI 自家的
 *    whisper-1 会用空格标短语边界，开放权重的托管连空格都没有，是一堵墙。
 *    qwen3-asr 不走 whisper 那套，直接输出带标点的中文。
 *
 * verbose_json 是硬要求：没有它就没有段级时间戳，
 * 阅读页里"点段落跳到音频对应位置"整个废掉。支持的模型不多，
 * gpt-transcribe / gpt-4o-mini-transcribe / mai-transcribe / chirp-3 都是 400。
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/audio/transcriptions';
const MODEL = process.env.OPENROUTER_STT_MODEL ?? 'qwen/qwen3-asr-1.7b';

function apiKey(): string {
  return process.env.OPENROUTER_API_KEY ?? '';
}

export async function checkEnv(): Promise<string | null> {
  if (!apiKey()) return '缺少 OPENROUTER_API_KEY';
  if (!(await hasFfmpeg())) return '需要 ffmpeg 做切片，请先安装';
  return null;
}

interface ChunkResult {
  text: string;
  segments: Segment[];
  duration: number;
  cost: number;
}

async function callOpenRouter(mp3: Buffer, lang: 'zh' | 'en'): Promise<ChunkResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        'Content-Type': 'application/json',
        // OpenRouter 用这两个头做用量归因，填上便于在后台按项目看花销
        'HTTP-Referer': 'https://newsdaily-pti.pages.dev',
        'X-Title': 'Newsdaily',
      },
      body: JSON.stringify({
        model: MODEL,
        input_audio: { data: mp3.toString('base64'), format: 'mp3' },
        language: lang,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        temperature: 0,
      }),
      signal: ctrl.signal,
    });

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const msg = JSON.stringify(json?.error ?? json).slice(0, 240);
      // 402 是余额不够，跟这条音频无关：立刻收工，不该记到任务头上，
      // 也不该继续拿剩下的任务去撞同一堵墙
      if (res.status === 402 || /insufficient|credit|quota/i.test(msg)) {
        throw new QuotaExceededError(`OpenRouter 余额不足：${msg}`);
      }
      if (res.status === 400 && /verbose_json|response_format/i.test(msg)) {
        throw new Error(
          `${MODEL} 不支持 verbose_json，拿不到时间戳，音频跳转会废掉：${msg}\n` +
            `  跑 scripts/probe-openrouter.ts 看哪些模型支持，或换回 qwen/qwen3-asr-1.7b`,
        );
      }
      throw new Error(`OpenRouter HTTP ${res.status}: ${msg}`);
    }

    const segs: Segment[] = Array.isArray(json.segments)
      ? json.segments.map((s: any) => ({
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          text: String(s.text ?? '').trim(),
        }))
      : [];

    return {
      text: String(json.text ?? '').trim(),
      segments: segs,
      duration: Number(json.duration) || Number(json.usage?.seconds) || 0,
      cost: Number(json.usage?.cost) || 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 下载 → 切片 → 逐片转写 → 按时间轴拼回去 */
export async function transcribeAudio(
  audioUrl: string,
  lang: 'zh' | 'en',
): Promise<Transcription> {
  const chunked = await downloadAndChunk(audioUrl);
  try {
    const segments: Segment[] = [];
    const texts: string[] = [];
    let duration = 0;
    let cost = 0;

    for (let i = 0; i < chunked.parts.length; i++) {
      const buf = await readFile(chunked.parts[i]);
      const offset = i * CHUNK_SECONDS;
      const r = await callOpenRouter(buf, lang);

      // 第一片就没时间戳，说明这个模型根本不返回 segments。
      // 后面十几片必然一样，继续跑只是花钱换一份不能跳转的残废逐字稿。
      if (i === 0 && r.text && !r.segments.length) {
        throw new Error(
          `${MODEL} 没有返回段级时间戳，逐字稿无法与音频对齐。` +
            `跑 scripts/probe-openrouter.ts 换个模型再试。`,
        );
      }

      if (r.text) texts.push(r.text);
      for (const s of r.segments) {
        segments.push({ start: s.start + offset, end: s.end + offset, text: s.text });
      }
      duration = offset + (r.duration || CHUNK_SECONDS);
      cost += r.cost;
    }

    const text = texts.join('\n').trim();
    if (!text) throw new Error('转写结果为空');
    console.log(
      `  [openrouter] ${MODEL} ${chunked.parts.length} 片，` +
        `${Math.round(duration / 60)} 分钟，花费 $${cost.toFixed(4)}`,
    );

    return {
      text,
      segments,
      durationSec: Math.round(duration),
      audioMinutes: Math.ceil(duration / 60),
    };
  } finally {
    await cleanup(chunked);
  }
}
