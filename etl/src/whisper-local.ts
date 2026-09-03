import { spawn } from 'node:child_process';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchUrl } from './fetch.js';
import type { Segment, Transcription } from './whisper.js';

/**
 * 本地 whisper 后端，接口与 whisper.ts（Cloudflare Workers AI）完全同构。
 *
 * 为什么要有第二条路：Workers AI 免费层每天只有 214 音频分钟，而且实测
 * 不按 00:00 UTC 重置，撞上就得干等。本机有独显时跑本地，额度无上限，
 * 队列一次性清空；Actions 上没有 GPU，仍然走 Workers AI。
 * 两边用同一个 large-v3-turbo 模型，产出的逐字稿质量一致。
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'etl', 'scripts', 'whisper_local.py');
const VENV_PY =
  process.platform === 'win32'
    ? path.join(REPO_ROOT, '.venv-whisper', 'Scripts', 'python.exe')
    : path.join(REPO_ROOT, '.venv-whisper', 'bin', 'python');

const MODEL = process.env.WHISPER_LOCAL_MODEL ?? 'large-v3-turbo';
const DEVICE = process.env.WHISPER_LOCAL_DEVICE ?? 'auto';

async function pythonPath(): Promise<string> {
  if (process.env.WHISPER_PYTHON) return process.env.WHISPER_PYTHON;
  try {
    await access(VENV_PY);
    return VENV_PY;
  } catch {
    return 'python';
  }
}

/** 环境自检，返回错误说明；null 表示可用 */
export async function checkEnv(): Promise<string | null> {
  const py = await pythonPath();
  try {
    await access(SCRIPT);
  } catch {
    return `找不到 ${SCRIPT}`;
  }
  return new Promise((resolve) => {
    const p = spawn(py, ['-c', 'import faster_whisper'], { stdio: 'ignore' });
    p.on('error', () => resolve(`无法运行 python：${py}`));
    p.on('close', (code) =>
      resolve(code === 0 ? null : `${py} 里没有 faster-whisper，先 pip install faster-whisper`),
    );
  });
}

interface PyResult {
  text: string;
  segments: Segment[];
  duration: number;
  device: string;
}

function runPython(py: string, args: string[]): Promise<PyResult> {
  return new Promise((resolve, reject) => {
    const p = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => {
      out += d.toString();
    });
    p.stderr.on('data', (d) => {
      const s = d.toString();
      err += s;
      if (err.length > 8000) err = err.slice(-4000);
      // 进度直接透传，一集要跑几分钟，没有输出会以为卡死
      for (const line of s.split(/\r?\n/)) {
        if (line.startsWith('[local]')) console.log(`  ${line}`);
      }
    });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`whisper_local 退出码 ${code}：${err.slice(-400)}`));
      try {
        resolve(JSON.parse(out) as PyResult);
      } catch {
        reject(new Error(`whisper_local 输出不是 JSON：${out.slice(0, 200)}`));
      }
    });
  });
}

/** 下载音频 → 本地 whisper 整段转写（PyAV 直接解码，不需要 ffmpeg 切片） */
export async function transcribeAudio(
  audioUrl: string,
  lang: 'zh' | 'en',
): Promise<Transcription> {
  const py = await pythonPath();
  const dir = await mkdtemp(path.join(tmpdir(), 'np-loc-'));
  try {
    const res = await fetchUrl(audioUrl, { timeout: 180000, retries: 2 });
    const raw = Buffer.from(await res.arrayBuffer());
    if (raw.length < 10000) throw new Error(`音频过小（${raw.length} 字节），可能是错误页`);
    const src = path.join(dir, 'src.audio');
    await writeFile(src, raw);

    const r = await runPython(py, [
      SCRIPT,
      '--audio', src,
      '--lang', lang,
      '--model', MODEL,
      '--device', DEVICE,
    ]);

    const text = (r.text ?? '').trim();
    if (!text) throw new Error('转写结果为空');
    const duration = r.duration || (r.segments.at(-1)?.end ?? 0);

    return {
      text,
      segments: r.segments,
      durationSec: Math.round(duration),
      audioMinutes: Math.ceil(duration / 60),
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
