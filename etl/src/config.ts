import 'node:process';

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

  // 是否对 kind=deep 且开启 offlineReading 的源做正文提取
  extractContent: env('EXTRACT_CONTENT', '1') === '1',
};

export function assertCloudflareCreds(): void {
  if (config.dryRun) return;
  if (!config.accountId || !config.apiToken) {
    throw new Error(
      '缺少 Cloudflare 凭据：请设置 CF_ACCOUNT_ID 与 CF_API_TOKEN（或 R2_ACCOUNT_ID/R2_API_TOKEN）',
    );
  }
}
