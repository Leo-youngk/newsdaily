import '../src/proxy.js';
import { parseFeed } from '../src/parse.js';
import { resolveTranscript } from '../src/transcript.js';
import { extractFromUrl } from '../src/extract.js';
import { transcriptToHtml } from '../src/html.js';
import { fetchText } from '../src/fetch.js';

/**
 * 加源前的实测探针：拿 feed 最新几集，真去把正文抓下来数字数。
 *
 * 存在的理由：源列表里写 readable: 'transcript' 只是声明，
 * 声明和现实经常不一致（feed 里根本没有 <podcast:transcript>、
 * 直链 404、拿到的是 5 分钟的预告片文稿）。不实测就加源，
 * 结果是 App 里一堆"正文暂时取不到"。
 *
 * 用法：npx tsx scripts/probe-source.ts <feed地址> [取几集] [正文选择器]
 */

const MIN = 1500;

function stat(t: string) {
  const cjk = (t.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) ?? []).length;
  return `${t.length} 字${cjk / (t.length || 1) > 0.2 ? `（汉字 ${((cjk / t.length) * 100) | 0}%）` : ''}`;
}

async function main() {
  const feed = process.argv[2];
  const n = parseInt(process.argv[3] ?? '3', 10);
  const selector = process.argv[4];
  if (!feed) {
    console.error('用法：npx tsx scripts/probe-source.ts <feed地址> [取几集]');
    process.exit(1);
  }

  const entries = await parseFeed(feed);
  console.log(`feed 解析到 ${entries.length} 条，测前 ${Math.min(n, entries.length)} 条\n`);

  for (const e of entries.slice(0, n)) {
    console.log(`▸ ${(e.title ?? '').slice(0, 64)}`);
    console.log(`  ${e.link}`);

    // feed 自带的正文（content:encoded / description），full 走的就是这个
    const inline = (e.contentHtml ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`  feed 内嵌正文: ${stat(inline)}${inline.length >= MIN ? '  ← readable: full 可用' : ''}`);

    // <podcast:transcript> 直链
    if (e.transcripts?.length) {
      console.log(`  podcast:transcript 标签 ${e.transcripts.length} 个：`);
      for (const ref of e.transcripts.slice(0, 4)) {
        try {
          const raw = await fetchText(ref.url, { timeout: 30000, retries: 0 });
          const { text } = transcriptToHtml(raw, ref.type, ref.url);
          console.log(`    ${text.length >= MIN ? '✓' : '✗'} ${(ref.type ?? '?').padEnd(16)} ${stat(text).padEnd(12)} ${ref.url.slice(0, 74)}`);
        } catch (err) {
          console.log(`    ✗ ${(ref.type ?? '?').padEnd(16)} 取不到：${err instanceof Error ? err.message.slice(0, 60) : ''}`);
        }
      }
    } else {
      console.log('  podcast:transcript 标签: 无');
    }

    // 单集页正文提取，extract 走的就是这个
    if (e.link) {
      const ex = await extractFromUrl(e.link, selector).catch(() => null);
      console.log(`  单集页提取${selector ? `（选择器 ${selector}）` : ''}: ${ex ? stat(ex.text) : '失败'}${ex && ex.text.length >= MIN ? '  ← readable: extract 可用' : ''}`);
    }

    const r = await resolveTranscript(e.link ?? '', e.transcripts ?? [], undefined, MIN).catch(() => null);
    console.log(`  ⇒ resolveTranscript: ${r ? `${r.source} / ${stat(r.text)}` : '拿不到'}`);
    console.log(`  音频: ${e.audioUrl ? `${Math.round((e.durationSec ?? 0) / 60)} 分钟` : '无'}\n`);
  }
}

main();
