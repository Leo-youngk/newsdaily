import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as R2 from './r2.js';
import { config } from './config.js';
import type { Item, ItemDetail, LatestIndex, AppConfig, TranscribeQueue } from './types.js';

/** 统一存储层：DRY_RUN 时写本地 out/，否则写 R2 */

async function localPath(key: string): Promise<string> {
  const p = path.join(config.outDir, key);
  await mkdir(path.dirname(p), { recursive: true });
  return p;
}

export async function putText(key: string, text: string): Promise<void> {
  if (config.dryRun) {
    const p = await localPath(key);
    await writeFile(p, text, 'utf8');
    return;
  }
  await R2.putObjectText(key, text);
}

export async function putJson(key: string, value: unknown): Promise<void> {
  await putText(key, JSON.stringify(value));
}

export async function putImage(
  key: string,
  buf: Buffer,
  skipIfExists = true,
): Promise<{ skipped: boolean }> {
  if (config.dryRun) {
    const p = await localPath(key);
    if (skipIfExists && existsSync(p)) return { skipped: true };
    await writeFile(p, buf);
    return { skipped: false };
  }
  if (skipIfExists && (await R2.objectExists(key))) return { skipped: true };
  await R2.putObjectBuffer(key, buf, 'image/webp');
  return { skipped: false };
}

/** 图片是否已在存储里（内容寻址，存在即可跳过下载与转码） */
export async function imageExists(key: string): Promise<boolean> {
  if (config.dryRun) return existsSync(path.join(config.outDir, key));
  return await R2.objectExists(key);
}

export async function getText(key: string): Promise<string | null> {
  if (config.dryRun) {
    const p = path.join(config.outDir, key);
    if (!existsSync(p)) return null;
    return await readFile(p, 'utf8');
  }
  return await R2.getObjectText(key);
}

export async function getJson<T>(key: string): Promise<T | null> {
  const t = await getText(key);
  if (t == null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    throw new Error(`存储对象 ${key} 不是有效 JSON`);
  }
}

export async function deleteKey(key: string): Promise<void> {
  if (config.dryRun) return;
  await R2.deleteObject(key);
}

export async function listKeys(prefix: string): Promise<string[]> {
  if (config.dryRun) return [];
  const objs = await R2.listObjects(prefix);
  return objs.map((o) => o.key);
}

// ---- 高层产物写入 ----

export async function writeItems(date: string, items: Item[]): Promise<void> {
  await putJson(`items/${date}.json`, { date, generatedAt: Date.now(), items });
}

export async function readItems(date: string, required = false): Promise<Item[]> {
  const data = await getJson<{ items: Item[] }>(`items/${date}.json`);
  if (data == null) {
    if (required) throw new Error(`保留分片 items/${date}.json 不存在，停止清理`);
    return [];
  }
  if (!Array.isArray(data.items) || data.items.some((it) => !it || typeof it.id !== 'string')) {
    throw new Error(`分片 items/${date}.json 格式错误`);
  }
  return data.items;
}

export async function writeDetail(detail: ItemDetail): Promise<void> {
  await putJson(`detail/${detail.id}.json`, detail);
}

export async function readDetail(id: string): Promise<ItemDetail | null> {
  return await getJson<ItemDetail>(`detail/${id}.json`);
}

export async function writeIndex(index: LatestIndex): Promise<void> {
  await putJson('index/latest.json', index);
}

export async function readIndex(): Promise<LatestIndex | null> {
  return await getJson<LatestIndex>('index/latest.json');
}

export async function writeConfig(cfg: AppConfig): Promise<void> {
  await putJson('config/sources.json', cfg);
}

export async function readConfig(): Promise<AppConfig | null> {
  return await getJson<AppConfig>('config/sources.json');
}

export async function readQueue(): Promise<TranscribeQueue | null> {
  return await getJson<TranscribeQueue>('meta/transcribe-queue.json');
}

export async function writeQueue(q: TranscribeQueue): Promise<void> {
  await putJson('meta/transcribe-queue.json', q);
}

export async function writeHealth(health: unknown): Promise<void> {
  await putJson('meta/health.json', health);
}

export async function readHealth<T>(): Promise<T | null> {
  return await getJson<T>('meta/health.json');
}
