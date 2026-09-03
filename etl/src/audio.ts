import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fetchUrl } from './fetch.js';

/**
 * 音频下载与切片，两条走网络的转写后端（Workers AI / OpenRouter）共用。
 *
 * 抽出来是因为切片参数必须两边一致：谁改了采样率或分片长度而另一边没跟上，
 * 产出的逐字稿质量就会莫名其妙地不一样，而且很难查。
 */

/** 每片 5 分钟：16kHz 单声道 32kbps mp3 约 1.2MB，base64 后 1.6MB，请求体很安全 */
export const CHUNK_SECONDS = 300;

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

export interface Chunked {
  /** 临时目录，用完必须 cleanup */
  dir: string;
  /** 切片文件的绝对路径，按时间顺序 */
  parts: string[];
}

/** 下载音频 → ffmpeg 转 16kHz 单声道 mp3 并按 CHUNK_SECONDS 切片 */
export async function downloadAndChunk(audioUrl: string): Promise<Chunked> {
  const dir = await mkdtemp(path.join(tmpdir(), 'np-au-'));
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
    return { dir, parts: parts.map((f) => path.join(dir, f)) };
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function cleanup(c: Chunked): Promise<void> {
  await rm(c.dir, { recursive: true, force: true }).catch(() => {});
}
