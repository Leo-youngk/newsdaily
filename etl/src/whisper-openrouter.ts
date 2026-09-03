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
 * 模型选 whisper-1（$0.006/音频分钟 = $0.36/小时），实测下来唯一能用的。
 * 2026-09-03 拿硅谷101 E250 的真实 5 分钟切片把候选全打了一遍：
 *
 *   模型                        标点/字数   时间戳   单价
 *   whisper-1 @ OpenAI          99/1588     有       $0.360/h
 *   whisper-large-v3-turbo      16/1508     有       $0.012/h
 *   whisper-large-v3 @ Groq      0/1390     有       $0.090/h
 *   whisper-large-v3 @ Together  0/1541     有       $0.111/h
 *   voxtral / qwen3-asr / gpt-4o-transcribe → 400，只有 whisper 系支持 verbose_json
 *
 * 三条反直觉的实测结论，别再重新试一遍：
 *
 * 1. 供应商钉不住。STT 的 provider 字段只有 options（按供应商透传参数），
 *    没有 order/only；写了 only 也是静默忽略，永远路由到最便宜的那家。
 *    turbo 的三次请求（裸跑 / only:groq / only:together）产出逐字节相同、
 *    计费都是 $0.012/h（DeepInfra 的价），证明 only 没有生效。
 *    模型名后缀 `model@groq` 直接 400 "does not exist"。
 * 2. prompt 透传没用，加不加引导词输出完全一样。
 * 3. 中文标点的真正来源是前文条件化（本地那条路已经证过一次），
 *    而开放权重的那几家托管都关了它，所以整篇几乎没有标点，没法读。
 *    whisper-1 是 OpenAI 自家推理，标点密度约每 16 字一个，比本机跑出来的还密。
 *
 * 所以贵 30 倍的 whisper-1 是唯一选择。中文播客月产约 19 小时 ≈ $7/月。
 *
 * verbose_json 是硬要求：没有它就没有段级时间戳，
 * 阅读页里"点段落跳到音频对应位置"整个废掉，只剩一坨纯文本。
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/audio/transcriptions';
const MODEL = process.env.OPENROUTER_STT_MODEL ?? 'openai/whisper-1';

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
            `  只有 whisper 系支持，把 OPENROUTER_STT_MODEL 换回 openai/whisper-1`,
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
