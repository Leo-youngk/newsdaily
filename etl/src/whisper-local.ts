import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

/** 0xC0000142 STATUS_DLL_INIT_FAILED：上一个进程的显存还没释放，CUDA 初始化不上 */
const DLL_INIT_FAILED = 3221225794;
/** 一集转完到下一集之间留的间隔，给驱动时间回收显存 */
const COOLDOWN_MS = 4000;

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

function runPython(py: string, args: string[], resultFile: string): Promise<PyResult> {
  return new Promise((resolve, reject) => {
    // 结果走文件而不是 stdout：Windows 上 python 的 stdout 被管道接走时
    // 默认按系统 ANSI 代码页编码，中文逐字稿会整篇变成乱码。
    // PYTHONIOENCODING 是第二道保险，管住剩下那些 print。
    const p = spawn(py, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let err = '';
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
    p.on('close', async (code) => {
      if (code !== 0) return reject(new Error(`whisper_local 退出码 ${code}：${err.slice(-400)}`));
      try {
        const raw = await readFile(resultFile, 'utf8');
        resolve(JSON.parse(raw) as PyResult);
      } catch (e) {
        reject(new Error(`读不到 whisper_local 的结果文件：${(e as Error).message}`));
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

    const resultFile = path.join(dir, 'result.json');
    const argv = [SCRIPT, '--audio', src, '--lang', lang, '--model', MODEL, '--device', DEVICE, '--out', resultFile];

    let r: PyResult;
    try {
      r = await runPython(py, argv, resultFile);
    } catch (e) {
      // 4G 显存的笔记本显卡上，上一集刚退出、显存还没回收完，
      // 下一个进程会直接死在 DLL 初始化（0xC0000142），跟音频本身无关。
      // 等一会儿重来一次就好，不该记到这条任务头上。
      if (!(e as Error).message.includes(String(DLL_INIT_FAILED))) throw e;
      console.log('  [local] 显存尚未释放，等 10 秒重试一次');
      await new Promise((res) => setTimeout(res, 10000));
      r = await runPython(py, argv, resultFile);
    }

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
    // 给驱动一点时间把显存还回来，否则下一集大概率死在 CUDA 初始化
    await new Promise((res) => setTimeout(res, COOLDOWN_MS));
  }
}
