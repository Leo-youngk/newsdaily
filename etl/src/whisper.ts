import { readFile } from 'node:fs/promises';
import { CHUNK_SECONDS, cleanup, downloadAndChunk, hasFfmpeg } from './audio.js';
import { config } from './config.js';

/**
 * 用 Cloudflare Workers AI 的 whisper-large-v3-turbo 转写播客。
 *
 * 选它而不是 whisper.cpp 跑在 Actions runner 上：
 *   - 免费额度 10,000 neurons/天，转写按 46.63 neurons/音频分钟计
 *     → 每天 214 分钟音频免费，中文播客月产约 16 集完全够
 *   - large-v3-turbo 的中文质量远好于 CPU 上跑得动的 small 模型
 *   - runner 上只做 ffmpeg 切片，不做推理，一集几十秒而不是二十分钟
 */

const MODEL = '@cf/openai/whisper-large-v3-turbo';

/** 额度耗尽。与普通失败区分开：不该记到任务头上，也不该继续试下一条。 */
export class QuotaExceededError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'QuotaExceededError';
  }
}

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  text: string;
  segments: Segment[];
  durationSec: number;
  /** 实际计费的音频分钟数，用于控制额度 */
  audioMinutes: number;
}

/** 环境自检，返回错误说明；null 表示可用。与 whisper-local.ts 同构。 */
export async function checkEnv(): Promise<string | null> {
  return (await hasFfmpeg()) ? null : '需要 ffmpeg 做切片，请先安装';
}

/**
 * 给 whisper 的引导词。
 * 中文转写默认几乎不输出标点，整集会连成一片没法读；
 * 用一段带标准标点的示例文本做 initial_prompt 是公认有效的做法，
 * 顺带也能把分段逻辑（依赖句末标点）激活。
 */
const INITIAL_PROMPT: Record<string, string> = {
  zh: '以下是一段普通话播客对话的文字记录，使用标准中文标点符号。比如：这个问题我们先放一放，等会儿再聊。你觉得呢？对，我同意。',
  en: '',
};

async function callWhisper(
  mp3: Buffer,
  lang: string,
): Promise<{ text: string; segments: Segment[]; duration: number }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${MODEL}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 180000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: mp3.toString('base64'),
        task: 'transcribe',
        language: lang,
        ...(INITIAL_PROMPT[lang] ? { initial_prompt: INITIAL_PROMPT[lang] } : {}),
        // 过滤静音段，减少 whisper 在空白处的幻觉输出
        vad_filter: true,
      }),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || !json?.result) {
      const msg = JSON.stringify(json?.errors ?? json).slice(0, 200);
      if (res.status === 429 || /free allocation|neurons/i.test(msg)) {
        throw new QuotaExceededError(`Workers AI 额度耗尽：${msg}`);
      }
      throw new Error(`whisper HTTP ${res.status}: ${msg}`);
    }
    const r = json.result;
    return {
      text: String(r.text ?? '').trim(),
      segments: Array.isArray(r.segments)
        ? r.segments.map((s: any) => ({
            start: Number(s.start) || 0,
            end: Number(s.end) || 0,
            text: String(s.text ?? '').trim(),
          }))
        : [],
      duration: Number(r.transcription_info?.duration) || 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 下载音频 → ffmpeg 转 16kHz 单声道 mp3 并切片 → 逐片转写 → 按时间轴拼回去 */
export async function transcribeAudio(
  audioUrl: string,
  lang: 'zh' | 'en',
): Promise<Transcription> {
  const chunked = await downloadAndChunk(audioUrl);
  try {
    const segments: Segment[] = [];
    const texts: string[] = [];
    let duration = 0;

    for (let i = 0; i < chunked.parts.length; i++) {
      const buf = await readFile(chunked.parts[i]);
      const offset = i * CHUNK_SECONDS;
      const r = await callWhisper(buf, lang);
      if (r.text) texts.push(r.text);
      for (const s of r.segments) {
        segments.push({ start: s.start + offset, end: s.end + offset, text: s.text });
      }
      duration = offset + (r.duration || CHUNK_SECONDS);
    }

    const text = texts.join('\n').trim();
    if (!text) throw new Error('转写结果为空');

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

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CJK = '\u3400-\u4dbf\u4e00-\u9fff';
const FULL: Record<string, string> = {
  ',': '，', '.': '。', '?': '？', '!': '！', ':': '：', ';': '；',
};
const HALF_AFTER_CJK = new RegExp(`([${CJK}])\s*([,.?!:;])\s*`, 'g');
// 左邻不是汉字、但右邻是汉字的那批：「硅谷101,我是」「MRA,然后」「AI,当时」。
// 实测占全部标点的 0.7%，而 3,000 / GPT-4.5 / v1.2 的右邻都是数字，不会被误伤。
const HALF_BEFORE_CJK = new RegExp(`\s*([,.?!:;])\s*(?=[${CJK}])`, 'g');
const SPACE_BETWEEN_CJK = new RegExp(`([${CJK}]) +(?=[${CJK}])`, 'g');
const ANY_PUNCT = /[，。？！：；、,.?!;:]/g;
const AFTER_FULL_PUNCT = /([，。？！：；、]) +/g;

/**
 * 这份稿子到底有没有标点。
 *
 * whisper 转中文**对话**时经常一个标点都不给（实测跟模型、供应商、
 * 切片长度都无关，是内容决定的：念稿的开场白有标点，一进访谈就没了），
 * 转而用空格标出短语边界 —— whisper-1 实测每 12 个字一个空格。
 * 这种时候空格是全篇唯一的结构。
 *
 * 阈值取每 100 字一个标点：有标点的段落实测密度是每 16 字一个，
 * 差着一个数量级，不会误判。
 */
function isPunctuated(text: string): boolean {
  return text.length > 0 && (text.match(ANY_PUNCT) ?? []).length / text.length > 0.01;
}

/**
 * 中文逐字稿的标点规范化。
 *
 * whisper 输出的中文里半角标点混着全角（"有些无聊,又有些混沌"），
 * 读起来很脏。判据是两侧有没有汉字：只要一侧紧挨汉字就转全角 ——
 * "GPT-4.5"、"v1.2"、"3,000" 两侧都是数字或字母，不会被误伤。
 *
 * 汉字之间多余的空格只在**有标点**时才删。没有标点的稿子里那些空格
 * 就是短语边界，删掉会把一整集压成几千字连成一片，彻底读不了 ——
 * 上一版就是这么把 whisper-1 唯一的可读性优势抹掉的（它比 turbo 贵 30 倍，
 * 买的就是这个：turbo 和 large-v3 既没标点也没空格，是真的一堵墙）。
 */
export function normalizeZhTranscript(t: Transcription): Transcription {
  const punctuated = isPunctuated(t.text);
  const fix = (s: string) => {
    const out = s
      .replace(HALF_AFTER_CJK, (_m, c: string, p: string) => c + FULL[p])
      .replace(HALF_BEFORE_CJK, (_m, p: string) => FULL[p])
      // 全角标点自带停顿，后面再跟空格是拼接切片留下的，一律去掉
      .replace(AFTER_FULL_PUNCT, '$1');
    return punctuated ? out.replace(SPACE_BETWEEN_CJK, '$1') : out;
  };
  return {
    ...t,
    text: fix(t.text),
    segments: t.segments.map((s) => ({ ...s, text: fix(s.text) })),
  };
}

/**
 * 把带时间戳的片段合成可读段落。
 * 每段带 data-t 秒数，前端据此让点击段落跳转到音频对应位置。
 */
export function segmentsToHtml(t: Transcription, lang: 'zh' | 'en'): string {
  if (!t.segments.length) {
    return t.text
      .split(/\n+/)
      .filter(Boolean)
      .map((p) => `<p>${esc(p)}</p>`)
      .join('');
  }
  // 没有标点的稿子断不出句子，只能按长度硬断。段落必须短得多，
  // 否则就是一屏 460 字的墙；顺带让时间戳更密，点哪句跳哪句
  const punctuated = isPunctuated(t.text);
  const maxChars = lang === 'en' ? 600 : punctuated ? 260 : 120;
  const out: string[] = [];
  let buf: string[] = [];
  let start = t.segments[0].start;
  let len = 0;

  const flush = () => {
    if (!buf.length) return;
    const body = buf.join(lang === 'zh' ? '' : ' ').trim();
    if (body) {
      out.push(
        `<p data-t="${Math.floor(start)}"><span class="ts">${fmtTime(start)}</span>${esc(body)}</p>`,
      );
    }
    buf = [];
    len = 0;
  };

  for (const s of t.segments) {
    if (!buf.length) start = s.start;
    buf.push(s.text);
    len += s.text.length;
    // 攒够长度且落在句末就断段，避免把一句话切两半；
    // 万一模型仍然不给标点，按长度硬断，不能让一段几千字连成一片
    if (len >= maxChars && /[。！？.!?…」』"']$/.test(s.text)) flush();
    else if (len >= maxChars * 1.8) flush();
  }
  flush();
  return out.join('');
}
