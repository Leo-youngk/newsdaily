import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOP50_ARTICLES, type Top50Article } from '../src/top50-data.js';
import { md5 } from '../src/util.js';
import * as store from '../src/upload.js';
import { config } from '../src/config.js';
import type { Item, ItemDetail, LatestIndex } from '../src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'out');
const APP_PUBLIC_DATA = path.resolve(__dirname, '..', '..', 'app', 'public', 'data');

function buildHtml(a: Top50Article): string {
  let html = `<article class="classic-podcast-article" style="line-height: 1.7; font-size: 1.05rem; color: #1e293b;">`;
  html += `<div class="article-meta-banner" style="margin-bottom: 24px; padding: 16px 20px; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #2563eb; border-radius: 8px;">`;
  html += `<div style="font-weight: 700; font-size: 1.15rem; color: #1e3a8a; margin-bottom: 6px;">【核心公理与心智模型】</div>`;
  html += `<p style="margin: 0; line-height: 1.6; color: #1e293b; font-size: 1rem;">${a.coreInsight}</p>`;
  html += `</div>`;

  html += `<div class="article-summary" style="margin-bottom: 28px; line-height: 1.7; color: #334155; font-size: 1.05rem;">`;
  html += `<div style="font-weight: 600; margin-bottom: 8px; color: #0f172a;">导读与背景：</div>`;
  html += `<p style="margin: 0;">${a.summary}</p>`;
  html += `</div>`;

  for (const section of a.htmlSections) {
    html += `<section style="margin-top: 32px; margin-bottom: 28px;">`;
    html += `<h2 style="font-size: 1.3rem; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 18px;">${section.heading}</h2>`;
    
    for (const p of section.paragraphs) {
      html += `<div class="bilingual-block" style="margin-bottom: 20px; padding: 14px 18px; background: #f8fafc; border-radius: 8px; border: 1px solid #f1f5f9;">`;
      html += `<p class="en-text" style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.05rem; line-height: 1.65; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${p.en}</p>`;
      html += `<p class="zh-text" style="margin: 0; color: #334155; font-size: 1rem; line-height: 1.65; border-top: 1px dashed #e2e8f0; padding-top: 8px;">${p.zh}</p>`;
      html += `</div>`;
    }
    html += `</section>`;
  }

  html += `<footer style="margin-top: 40px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 0.9rem; color: #64748b;">`;
  html += `<div><strong>官方节目：</strong>${a.sourceName} · <strong>主讲/受访：</strong>${a.author}</div>`;
  html += `<div><strong>官方完整文稿索引：</strong><a href="${a.url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${a.url}</a></div>`;
  html += `</footer>`;
  html += `</article>`;
  return html;
}

function buildText(a: Top50Article): string {
  let text = `${a.titleZh}\n${a.title}\n作者：${a.author}\n\n【核心公理】\n${a.coreInsight}\n\n【导读】\n${a.summary}\n\n`;
  for (const s of a.htmlSections) {
    text += `### ${s.heading}\n\n`;
    for (const p of s.paragraphs) {
      text += `${p.en}\n${p.zh}\n\n`;
    }
  }
  text += `官方链接：${a.url}\n`;
  return text;
}

async function main() {
  console.log(`[top50] 开始构建与注入 ${TOP50_ARTICLES.length} 篇殿堂级播客文稿...`);
  await mkdir(path.join(OUT_DIR, 'detail'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'items'), { recursive: true });
  await mkdir(path.join(OUT_DIR, 'index'), { recursive: true });

  const now = Date.now();
  const builtItems: Item[] = [];
  const idList: string[] = [];

  for (let i = 0; i < TOP50_ARTICLES.length; i++) {
    const a = TOP50_ARTICLES[i];
    const id = md5(`${a.sourceId}:${a.url}`);
    idList.push(id);

    const html = buildHtml(a);
    const text = buildText(a);

    // 1. 写 detail/<id>.json 到本地
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

  // 3. 更新分片 items/2026-09-03.json
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

  await writeFile(
    shardPath,
    JSON.stringify({ date: '2026-09-03', items: allMergedItems }),
    'utf8'
  );
  console.log(`[top50] 已更新分片 items/2026-09-03.json，共 ${allMergedItems.length} 条（置顶 50 篇常青精选）`);

  // 4. 更新 index/latest.json
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
  console.log(`[top50] 已更新 index/latest.json，总条数 ${latest.itemCount}，全部分类索引建立完成！`);

  // 5. 如果存在 app/public，同步复制一份到 app/public/data，方便本地预览
  try {
    await mkdir(path.join(APP_PUBLIC_DATA, 'detail'), { recursive: true });
    await mkdir(path.join(APP_PUBLIC_DATA, 'items'), { recursive: true });
    await mkdir(path.join(APP_PUBLIC_DATA, 'index'), { recursive: true });
    
    // 复制 index 和 items
    await cp(indexPath, path.join(APP_PUBLIC_DATA, 'index', 'latest.json'));
    await cp(shardPath, path.join(APP_PUBLIC_DATA, 'items', '2026-09-03.json'));
    
    // 复制 50 篇详情
    for (const id of idList) {
      await cp(
        path.join(OUT_DIR, 'detail', `${id}.json`),
        path.join(APP_PUBLIC_DATA, 'detail', `${id}.json`)
      );
    }
    console.log(`[top50] 已同步至 app/public/data/，本地前端离线与直连调试已就绪！`);
  } catch (err) {
    console.warn(`[top50] 同步至 app/public/data 失败（可忽略）:`, err);
  }
}

main().catch((err) => {
  console.error('[top50] 失败:', err);
  process.exit(1);
});
