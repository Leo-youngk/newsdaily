import 'node:process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 加载本地 .env。
 *
 * 以前没有这一步：Actions 上的环境变量由 workflow 注入，跑得好好的，
 * 但本地必须先在 shell 里手动 export，换个终端就变成「R2 读不到」。
 * 本地跑转写成为常规操作之后，这个坑必须补上。
 *
 * 不引 dotenv：这点需求用不上一个依赖。
 * 已存在的环境变量优先——Actions 上的真实凭据不能被仓库里的文件盖掉。
 */
function loadDotEnv(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const dir of [process.cwd(), path.resolve(here, '..')]) {
    let raw: string;
    try {
      raw = readFileSync(path.join(dir, '.env'), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const key = m[1];
      if (process.env[key]) continue;
      let v = m[2].trim();
      const q = v[0];
      if (v.length > 1 && (q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1);
      process.env[key] = v;
    }
    return;
  }
}

loadDotEnv();

function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v;
}

function intEnv(name: string, fallback: number): number {
  const v = parseInt(env(name, String(fallback)), 10);
  return Number.isNaN(v) ? fallback : v;
}

export const config = {
  // Cloudflare R2（走 REST API，只需 Account ID + API Token）
  accountId: env('CF_ACCOUNT_ID', env('R2_ACCOUNT_ID')),
  apiToken: env('CF_API_TOKEN', env('R2_API_TOKEN')),
  bucket: env('R2_BUCKET', 'news-pwa'),

  // 图片在 Item.image 中的前缀：Worker 通过 /data/* 透传 R2，
  // 若开启了 R2 公共开发域名，可设为 https://pub-xxxx.r2.dev/
  imgBase: env('IMG_BASE', '/data/'),

  // 抓取参数
  concurrency: intEnv('CONCURRENCY', 5),
  ogConcurrency: intEnv('OG_CONCURRENCY', 3),
  sourceTimeout: intEnv('SOURCE_TIMEOUT', 15000),
  ogTimeout: intEnv('OG_TIMEOUT', 8000),
  retries: intEnv('RETRIES', 1),

  // 图片转存参数
  imgMaxWidth: intEnv('IMG_MAX_WIDTH', 800),
  imgQuality: intEnv('IMG_QUALITY', 78),

  // 保留策略
  retentionDays: intEnv('RETENTION_DAYS', 30),
  dedupeWindowDays: intEnv('DEDUPE_WINDOW_DAYS', 7),

  // DRY_RUN=1 时不写 R2，产物落到 ./out 便于本地验证
  dryRun: env('DRY_RUN', '0') === '1',
  outDir: env('OUT_DIR', 'out'),

  // 图片是加分项不是必需品：IMAGES=0 可整体关掉图片处理
  images: env('IMAGES', '1') === '1',
};

export function assertCloudflareCreds(): void {
  if (config.dryRun) return;
  if (!config.accountId || !config.apiToken) {
    throw new Error(
      '缺少 Cloudflare 凭据：请设置 CF_ACCOUNT_ID 与 CF_API_TOKEN（或 R2_ACCOUNT_ID/R2_API_TOKEN）',
    );
  }
}
