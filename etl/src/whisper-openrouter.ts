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
 * 模型默认 whisper-large-v3-turbo，跟本地和 Workers AI 是同一个模型，
 * 三条路产出的逐字稿质量一致，不会出现"哪天转的决定了读起来什么样"。
 *
 * 供应商必须钉死：OpenRouter 默认按价格路由，turbo 最便宜的是 DeepInfra，
 * 而 **verbose_json 只有 OpenAI 兼容供应商（OpenAI / Groq / Together）支持，
 * 别家直接 400**。没有 verbose_json 就没有段级时间戳，阅读页里
 * "点段落跳到音频对应位置"就废了，只剩一坨纯文本。
 * Groq 还额外支持 prompt 透传，中文标点全靠它。
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/audio/transcriptions';
const MODEL = process.env.OPENROUTER_STT_MODEL ?? 'openai/whisper-large-v3-turbo';
/** 供应商 slug，必须是 OpenAI 兼容的那几家，否则 verbose_json 被 400 */
const PROVIDER = process.env.OPENROUTER_STT_PROVIDER ?? 'groq';

/** 与 whisper.ts / whisper_local.py 保持同一段引导词 */
const INITIAL_PROMPT: Record<string, string> = {
  zh: '以下是一段普通话播客对话的文字记录，使用标准中文标点符号。比如：这个问题我们先放一放，等会儿再聊。你觉得呢？对，我同意。',
  en: '',
};

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
        // 没有它就拿不到 segments，前端的音频跳转就废了
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        temperature: 0,
        provider: {
          // 只有匹配到的供应商的选项会被转发，其余静默丢弃，所以多写无害
          options: INITIAL_PROMPT[lang]
            ? { [PROVIDER]: { prompt: INITIAL_PROMPT[lang] } }
            : {},
        },
      }),
      signal: ctrl.signal,
    });

    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      const msg = JSON.stringify(json?.error ?? json).slice(0, 240);
      // 402 是余额不够，跟这条音频无关：立刻收工，不该记到任务头上，
      // 也不该继续拿剩下的任务去撞同一堵墙
      if (res.status === 402 || /insufficient|credit|quota/i.test(msg)) {
        throw new QuotaExceededError(`OpenRouter 余额不足或额度用尽：${msg}`);
      }
      if (res.status === 400 && /verbose|format/i.test(msg)) {
        throw new Error(
          `供应商不支持 verbose_json（拿不到时间戳）：${msg}\n` +
            `  把 OPENROUTER_STT_PROVIDER 换成 groq/openai/together，或改用 OPENROUTER_STT_MODEL=openai/whisper-1`,
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

      // 第一片就没时间戳，说明这个模型/供应商组合根本不返回 segments。
      // 后面十几片必然一样，继续跑只会花钱换一份不能跳转的残废逐字稿，
      // 所以立刻炸掉，把原因说清楚。
      if (i === 0 && r.text && !r.segments.length) {
        throw new Error(
          `${MODEL}@${PROVIDER} 没有返回段级时间戳，逐字稿无法与音频对齐。` +
            `换 OpenAI 兼容供应商（groq/openai/together）再试。`,
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
      `  [openrouter] ${MODEL}@${PROVIDER} ${chunked.parts.length} 片，` +
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
