import '../src/proxy.js';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import pLimit from 'p-limit';
import { parseFeed } from '../src/parse.js';
import { fetchText } from '../src/fetch.js';
import { extractFromUrl } from '../src/extract.js';
import { transcriptToHtml } from '../src/html.js';
import { cleanContentHtml } from '../src/html.js';

/**
 * 批量扫候选 feed，找"现成逐字稿"的源。
 *
 * 判据只有一个：最新一集真能拿到多少字正文。三条路各测一遍 ——
 * feed 内嵌（readable: full）、<podcast:transcript> 直链、单集页提取。
 * 声明和现实经常不一致（清单说"原生自带 transcript"，实测 feed 里
 * 一个标签都没有），所以一律实测，不看说明。
 *
 * 用法：npx tsx scripts/scan-feeds.ts candidates.txt out.jsonl
 * 候选文件每行「名字<tab>feed地址」，# 开头是注释。
 *
 * 结果逐条追加写 out.jsonl，重跑时自动跳过已完成的。
 * 必须这样：undici 遇到个别站点的畸形响应会在 socket 回调里抛
 * ERR_ASSERTION，那是我们 try/catch 抓不到的进程级崩溃，
 * 一次崩溃就会把前面几十个候选的结果全丢掉。
 */

const GOOD = 15000; // 逐字稿的门槛：低于这个基本就是 shownotes
const CONC = 6;

interface Row {
  name: string;
  url: string;
  err?: string;
  count?: number;
  inline?: number;
  tagged?: number;
  page?: number;
  tagTypes?: string;
  audio?: boolean;
}

async function scan(name: string, url: string): Promise<Row> {
  const row: Row = { name, url };
  let entries;
  try {
    entries = await parseFeed(url);
  } catch (e) {
    row.err = e instanceof Error ? e.message.slice(0, 70) : String(e);
    return row;
  }
  row.count = entries.length;
  const e = entries[0];
  if (!e) {
    row.err = 'feed 是空的';
    return row;
  }
  row.audio = !!e.audioUrl;
  row.inline = cleanContentHtml(e.contentHtml ?? '', url).text.length;

  for (const ref of (e.transcripts ?? []).slice(0, 3)) {
    try {
      const raw = await fetchText(ref.url, { timeout: 30000, retries: 0 });
      const { text } = transcriptToHtml(raw, ref.type, ref.url);
      if (text.length > (row.tagged ?? 0)) {
        row.tagged = text.length;
        row.tagTypes = ref.type;
      }
    } catch {
      /* 试下一个 */
    }
  }

  if ((row.tagged ?? 0) < GOOD && (row.inline ?? 0) < GOOD && e.link) {
    const ex = await extractFromUrl(e.link).catch(() => null);
    row.page = ex?.text.length ?? 0;
  }
  return row;
}

async function main() {
  const file = process.argv[2];
  const out = process.argv[3];
  if (!file || !out) {
    console.error('用法：npx tsx scripts/scan-feeds.ts <候选文件> <结果 jsonl>');
    process.exit(1);
  }
  const cands = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [name, url] = l.split(/\t+| {2,}/);
      return { name: (name ?? '').trim(), url: (url ?? '').trim() };
    })
    .filter((c) => c.url);

  console.log(`扫 ${cands.length} 个候选，并发 ${CONC}\n`);
  const limit = pLimit(CONC);
  const rows = await Promise.all(cands.map((c) => limit(() => scan(c.name, c.url))));

  const best = (r: Row) => Math.max(r.tagged ?? 0, r.inline ?? 0, r.page ?? 0);
  rows.sort((a, b) => best(b) - best(a));

  const n = (v: number | undefined) => (v == null ? '—' : v >= GOOD ? String(v) : `(${v})`);
  console.log('名字                          最新一集能拿到多少字            走哪条路   feed');
  console.log('                              内嵌      标签      页面');
  for (const r of rows) {
    if (r.err) {
      console.log(`✗ ${r.name.padEnd(28)} ${r.err}`);
      continue;
    }
    const b = best(r);
    const route =
      b < GOOD ? '不够' : (r.tagged ?? 0) >= GOOD ? `标签 ${r.tagTypes}` : (r.inline ?? 0) >= GOOD ? 'full' : 'extract';
    console.log(
      `${b >= GOOD ? '✓' : '✗'} ${r.name.padEnd(28)} ${n(r.inline).padStart(9)} ${n(r.tagged).padStart(9)} ${n(r.page).padStart(9)}   ${route.padEnd(18)} ${r.count} 集${r.audio ? '' : ' 无音频'}`,
    );
  }
  const ok = rows.filter((r) => !r.err && best(r) >= GOOD);
  console.log(`\n可用 ${ok.length} / ${rows.length}`);
}

main();
