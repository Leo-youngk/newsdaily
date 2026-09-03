import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOP50_ARTICLES, type Top50Article } from '../src/top50-data.js';
import { md5 } from '../src/util.js';
import * as R2 from '../src/r2.js';
import { config } from '../src/config.js';
import type { Item, ItemDetail, LatestIndex } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'out');
const APP_PUBLIC_DATA = path.resolve(__dirname, '..', '..', 'app', 'public', 'data');

function buildHtml(a: Top50Article): string {
  let html = `<article class="classic-podcast-article" style="line-height: 1.8; font-size: 1.05rem; color: #1e293b;">`;
  
  // 核心公理
  html += `<div class="article-meta-banner" style="margin-bottom: 24px; padding: 18px 22px; background: rgba(59, 130, 246, 0.08); border-left: 5px solid #2563eb; border-radius: 8px;">`;
  html += `<div style="font-weight: 700; font-size: 1.15rem; color: #1e3a8a; margin-bottom: 6px;">💡 【核心公理与思维模型】</div>`;
  html += `<p style="margin: 0; line-height: 1.65; color: #1e293b; font-size: 1.02rem;">${a.coreInsight}</p>`;
  html += `</div>`;

  // 导读
  html += `<div class="article-summary" style="margin-bottom: 28px; line-height: 1.75; color: #334155; font-size: 1.05rem;">`;
  html += `<div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 8px; color: #0f172a;">📖 【深度导读与背景】</div>`;
  html += `<p style="margin: 0;">${a.summary}</p>`;
  html += `</div>`;

  // 核心中英对齐正文章节
  for (const section of a.htmlSections) {
    html += `<section style="margin-top: 36px; margin-bottom: 28px;">`;
    html += `<h2 style="font-size: 1.35rem; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px;">${section.heading}</h2>`;
    
    for (const p of section.paragraphs) {
      html += `<div class="bilingual-block" style="margin-bottom: 22px; padding: 16px 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">`;
      html += `<p class="en-text" style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.05rem; line-height: 1.7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${p.en}</p>`;
      html += `<p class="zh-text" style="margin: 0; color: #334155; font-size: 1rem; line-height: 1.7; border-top: 1px dashed #cbd5e1; padding-top: 10px;">${p.zh}</p>`;
      html += `</div>`;
    }
    html += `</section>`;
  }

  // 结尾标注
  html += `<footer style="margin-top: 48px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.92rem; color: #64748b;">`;
  html += `<div><strong>播客收录：</strong>${a.sourceName} · <strong>主讲/嘉宾：</strong>${a.author}</div>`;
  html += `<div style="margin-top: 4px;"><strong>典藏标签：</strong>${a.tags.join(' · ')}</div>`;
  html += `</footer>`;
  html += `</article>`;
  return html;
}

function buildText(a: Top50Article): string {
  let text = `${a.titleZh}\n${a.title}\n作者：${a.author}\n\n【核心公理】\n${a.coreInsight}\n\n【导读】\n${a.summary}\n\n`;
  for (const s of a.htmlSections) {
    text += `### ${s.heading}\n\n`;
    for (const p of s.paragraphs) {
      text += `${p.en}\n\n${p.zh}\n\n`;
    }
  }
  text += `播客出处：${a.sourceName}\n`;
  return text;
}

async function main() {
  console.log(`[top50] 开始构建并三端同步（本地 out + app/public/data + Cloudflare R2）...`);
  await mkdir(path.join(OUT_DIR, 'detail'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'items'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'index'), { recursive: true });

  const now = Date.now();
  const builtItems: Item[] = [];
  const idList: string[] = [];
  const detailList: ItemDetail[] = [];

  for (let i = 0; i < TOP50_ARTICLES.length; i++) {
    const a = TOP50_ARTICLES[i];
    const id = md5(`${a.sourceId}:${a.url}`);
    idList.push(id);

    const html = buildHtml(a);
    const text = buildText(a);

    const detail: ItemDetail = {
      id,
      title: a.title,
      url: a.url,
      sourceId: a.sourceId,
      sourceName: a.sourceName,
      contentHtml: html,
      contentText: text,
      contentSource: 'transcript-page',
      extractedAt: now,
    };
    detailList.push(detail);

    // 1. 写本地 out/detail/<id>.json
    await writeFile(
      path.join(OUT_DIR, 'detail', `${id}.json`),
      JSON.stringify(detail, null, 2),
      'utf8'
    );

    // 2. 构造 Item
    const item: Item = {
      id,
      sourceId: a.sourceId,
      sourceName: a.sourceName,
      category: a.category,
      lang: a.lang,
      title: a.title,
      titleZh: a.titleZh,
      author: a.author,
      summary: a.summary,
      url: a.url,
      publishedAt: now - i * 60000,
      contentLen: text.length,
      contentSource: 'transcript-page',
      readingMinutes: a.readingMinutes,
      audioUrl: a.audioUrl,
      durationSec: a.readingMinutes * 60,
      tags: a.tags,
    };
    builtItems.push(item);
  }

  // 3. 构建分片 items/2026-09-03.json
  const shardPath = path.join(OUT_DIR, 'items', '2026-09-03.json');
  let existingItems: Item[] = [];
  try {
    const raw = await readFile(shardPath, 'utf8');
    const parsed = JSON.parse(raw);
    existingItems = parsed.items || [];
  } catch {
    existingItems = [];
  }

  const allMergedItems = [
    ...builtItems,
    ...existingItems.filter((it) => !idList.includes(it.id)),
  ];

  const shardData = { date: '2026-09-03', items: allMergedItems };
  await writeFile(shardPath, JSON.stringify(shardData), 'utf8');
  console.log(`[top50] 本地 items/2026-09-03.json 已生成（共 ${allMergedItems.length} 条，置顶 50 篇）`);

  // 4. 构建索引 index/latest.json
  const indexPath = path.join(OUT_DIR, 'index', 'latest.json');
  let latest: LatestIndex = {
    generatedAt: now,
    categories: {
      访谈: [],
      思想: [],
      商业: [],
      人文: [],
    },
    all: [],
    itemCount: allMergedItems.length,
    dates: ['2026-09-03'],
    readableRate: 100,
  };
  try {
    const raw = await readFile(indexPath, 'utf8');
    latest = JSON.parse(raw);
  } catch {}

  if (!latest.categories) latest.categories = {};
  for (const cat of ['访谈', '思想', '商业', '人文']) {
    if (!latest.categories[cat]) latest.categories[cat] = [];
  }

  for (const it of builtItems) {
    const catList = latest.categories[it.category] || [];
    latest.categories[it.category] = [it.id, ...catList.filter((x) => x !== it.id)];
    latest.all = [it.id, ...latest.all.filter((x) => x !== it.id)];
  }

  latest.itemCount = latest.all.length;
  latest.generatedAt = now;
  if (!latest.dates.includes('2026-09-03')) latest.dates.push('2026-09-03');

  await writeFile(indexPath, JSON.stringify(latest), 'utf8');
  console.log(`[top50] 本地 index/latest.json 已更新（总数 ${latest.itemCount}）`);

  // 5. 同步至 app/public/data/ (本地热更新支持)
  try {
    await mkdir(path.join(APP_PUBLIC_DATA, 'detail'), { recursive: true });
    await mkdir(path.join(APP_PUBLIC_DATA, 'items'), { recursive: true });
    await mkdir(path.join(APP_PUBLIC_DATA, 'index'), { recursive: true });
    await cp(indexPath, path.join(APP_PUBLIC_DATA, 'index', 'latest.json'));
    await cp(shardPath, path.join(APP_PUBLIC_DATA, 'items', '2026-09-03.json'));
    for (const id of idList) {
      await cp(
        path.join(OUT_DIR, 'detail', `${id}.json`),
        path.join(APP_PUBLIC_DATA, 'detail', `${id}.json`)
      );
    }
    console.log(`[top50] 本地前端目录 app/public/data/ 同步完成！`);
  } catch (err) {
    console.warn('[top50] 同步 app/public 警告:', err);
  }

  // 6. 直连写入 Cloudflare R2 存储桶 (保证线上访问不走外链)
  if (config.accountId && config.apiToken) {
    console.log(`[top50] 正在直连上传至 Cloudflare R2 (${config.bucket})...`);
    // 上传 index
    await R2.putObjectText('index/latest.json', JSON.stringify(latest));
    console.log(`  ✓ 已上传 R2: index/latest.json`);

    // 上传 items
    await R2.putObjectText('items/2026-09-03.json', JSON.stringify(shardData));
    console.log(`  ✓ 已上传 R2: items/2026-09-03.json`);

    // 上传 50 篇详情
    let uploadedCount = 0;
    for (const d of detailList) {
      await R2.putObjectText(`detail/${d.id}.json`, JSON.stringify(d));
      uploadedCount++;
    }
    console.log(`  ✓ 已上传 R2: ${uploadedCount} 篇 detail/*.json 完整详情正文！`);

    // 上传 config/sources.json 纯净配置
    try {
      const seedConfigRaw = await readFile(path.join(__dirname, '..', 'sources.seed.json'), 'utf8');
      await R2.putObjectText('config/sources.json', seedConfigRaw);
      console.log(`  ✓ 已上传 R2: config/sources.json 纯净版订阅配置！`);
    } catch {}
    console.log(`[top50] ✨ Cloudflare R2 线上同步全部完成！`);
  } else {
    console.log(`[top50] 未检测到 R2 凭据，仅写入本地。`);
  }
}

main().catch((err) => {
  console.error('[top50] 失败:', err);
  process.exit(1);
});
