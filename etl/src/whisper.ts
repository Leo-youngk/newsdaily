import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config } from './config.js';
import { fetchUrl } from './fetch.js';

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
/** 每片 5 分钟：16kHz 单声道 32kbps mp3 约 1.2MB，base64 后 1.6MB，请求体很安全 */
const CHUNK_SECONDS = 300;

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

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-4000);
    });
    p.on('error', reject);
    p.on('close', (code) => resolve({ code: code ?? -1, stderr }));
  });
}

export async function hasFfmpeg(): Promise<boolean> {
  try {
    const { code } = await run('ffmpeg', ['-version']);
    return code === 0;
  } catch {
    return false;
  }
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
  const dir = await mkdtemp(path.join(tmpdir(), 'np-tr-'));
  try {
    const res = await fetchUrl(audioUrl, { timeout: 120000, retries: 1 });
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length < 10000) throw new Error(`音频过小（${raw.length} 字节），可能是错误页`);
    const src = path.join(dir, 'src.audio');
    await writeFile(src, raw);

    const { code, stderr } = await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-i', src,
      '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k',
      '-f', 'segment', '-segment_time', String(CHUNK_SECONDS),
      path.join(dir, 'part_%04d.mp3'),
    ]);
    if (code !== 0) throw new Error(`ffmpeg 失败：${stderr.slice(0, 200)}`);

    const parts = (await readdir(dir)).filter((f) => f.startsWith('part_')).sort();
    if (!parts.length) throw new Error('ffmpeg 没有产出切片');

    const segments: Segment[] = [];
    const texts: string[] = [];
    let duration = 0;

    for (let i = 0; i < parts.length; i++) {
      const buf = await readFile(path.join(dir, parts[i]));
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
    await rm(dir, { recursive: true, force: true }).catch(() => {});
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
  const maxChars = lang === 'zh' ? 260 : 600;
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
