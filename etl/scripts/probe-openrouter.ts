import '../src/proxy.js';
import { readFile, stat } from 'node:fs/promises';
import { fetchUrl } from '../src/fetch.js';

/**
 * OpenRouter 转写选型探针：拿一段真音频，把候选 模型@供应商 都打一遍，
 * 报告「能不能拿到段级时间戳 / 中文标点够不够 / 真实花掉多少钱」。
 *
 * 存在的理由：OpenRouter 文档只说 verbose_json「仅 OpenAI 兼容供应商支持，
 * 其余 400」，但没说 STT 请求能不能钉死供应商（provider 字段只有 options，
 * 没有 order/only）。这三件事只能实测，不能猜——猜错的代价是一整队逐字稿
 * 没有时间戳，前端的音频跳转全废。
 *
 * 样本直接对源 mp3 发 Range 请求取开头一段，不经 ffmpeg：
 * 本机没装 ffmpeg CLI（生产跑在 Actions 上，那边自带），
 * 而 mp3 从任意字节截断只会丢掉最后半帧，对探针足够了。
 *
 * 每个候选只跑约 60 秒音频，总花费在 1 美分以内。
 * 用法：npx tsx scripts/probe-openrouter.ts <mp3 地址>
 */

const CANDIDATES: { model: string; provider: string }[] = [
  { model: 'openai/whisper-1', provider: 'openai' },
  { model: 'openai/whisper-large-v3-turbo', provider: 'groq' },
  { model: 'openai/whisper-large-v3', provider: 'groq' },
  { model: 'openai/whisper-large-v3', provider: 'together' },
];

const PROMPT_ZH =
  '以下是一段普通话播客对话的文字记录，使用标准中文标点符号。比如：这个问题我们先放一放，等会儿再聊。你觉得呢？对，我同意。';

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/g;
const PUNCT = /[，。？！：；、,.?!;:]/g;

async function probe(mp3: Buffer, model: string, provider: string) {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://newsdaily-pti.pages.dev',
      'X-Title': 'Newsdaily',
    },
    body: JSON.stringify({
      model,
      input_audio: { data: mp3.toString('base64'), format: 'mp3' },
      language: 'zh',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      temperature: 0,
      // 实测 provider 只有 options 生效、且 prompt 透传无效，
      // 这里保留只是为了让"换供应商试试"这条路一眼能试
      provider: { options: { [provider]: { prompt: PROMPT_ZH } } },
    }),
  });
  const j = (await res.json().catch(() => ({}))) as any;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res.ok) {
    console.log(`  ✗ HTTP ${res.status} (${secs}s) ${JSON.stringify(j?.error ?? j).slice(0, 200)}`);
    return;
  }
  const text = String(j.text ?? '');
  const segs = Array.isArray(j.segments) ? j.segments.length : 0;
  const cjk = (text.match(CJK) ?? []).length;
  const punct = (text.match(PUNCT) ?? []).length;
  console.log(
    `  ${segs ? '✓' : '✗'} ${secs}s | ${text.length} 字 | 汉字 ${
      text.length ? ((cjk / text.length) * 100).toFixed(0) : 0
    }% | 标点 ${punct} | segments ${segs} | \$${(Number(j.usage?.cost) || 0).toFixed(5)}` +
      ` | 实际供应商 ${j.provider ?? res.headers.get('x-or-provider') ?? '?'}`,
  );
  if (!segs) console.log('    ↑ 没有时间戳，音频跳转会废掉，不能用');
  console.log(`    ${text.slice(0, 90).replace(/\n/g, ' ')}…`);
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('缺少 OPENROUTER_API_KEY，请写进 etl/.env');
    process.exit(1);
  }
  const url = process.argv[2];
  if (!url) {
    console.error('用法：npx tsx scripts/probe-openrouter.ts <mp3 地址或本地 mp3 路径>');
    process.exit(1);
  }

  // 传本地文件时直接用，方便拿真实的 5 分钟切片测标点；
  // 传 URL 时取开头 1MB，只够验时间戳，标点判不准（几十秒还没到句末）
  const local = await stat(url).then(() => true).catch(() => false);
  let mp3: Buffer;
  if (local) {
    mp3 = await readFile(url);
    console.log(`样本 ${(mp3.length / 1024).toFixed(0)}KB（本地文件）
`);
  } else {
    const res = await fetchUrl(url, { timeout: 120000, retries: 1, headers: { Range: 'bytes=0-1048575' } });
    mp3 = Buffer.from(await res.arrayBuffer());
    console.log(`样本 ${(mp3.length / 1024).toFixed(0)}KB（HTTP ${res.status}，只够验时间戳）
`);
  }
  if (mp3.length < 50000) {
    console.error(`样本过小（${mp3.length} 字节），可能是错误页`);
    process.exit(1);
  }

  for (const c of CANDIDATES) {
    console.log(`${c.model} @ ${c.provider}`);
    try {
      await probe(mp3, c.model, c.provider);
    } catch (e) {
      console.log(`  ✗ ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log();
  }
}

main();
