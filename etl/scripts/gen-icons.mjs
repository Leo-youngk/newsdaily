// 生成 PWA 图标：从 SVG 渲染为 PNG（依赖 sharp，已在 etl 安装）
// 运行：node scripts/gen-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', '..', 'app', 'public', 'icons');

const PAPER = '#fffdfa';
const ACCENT = '#c05621';
const INK = '#1a1917';

// 书签 + 纸面的克制标记；scale 控制安全区（maskable 用较小 scale）
function svg(scale = 1) {
  const c = 256; // 中心
  const s = scale;
  // 书签路径（相对中心缩放）
  const bw = 92 * s; // 半宽
  const top = c - 128 * s;
  const bot = c + 150 * s;
  const notch = c + 96 * s;
  const r = 18 * s;
  const bookmark = `M ${c - bw} ${top + r}
    q 0 ${-r} ${r} ${-r}
    h ${2 * (bw - r)}
    q ${r} 0 ${r} ${r}
    V ${bot}
    L ${c} ${notch}
    L ${c - bw} ${bot} Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${PAPER}"/>
    <rect x="1" y="1" width="510" height="510" rx="0" fill="none"/>
    <path d="${bookmark}" fill="${ACCENT}"/>
    <rect x="${c - 46 * s}" y="${c - 66 * s}" width="${92 * s}" height="${10 * s}" rx="${5 * s}" fill="${PAPER}" opacity="0.9"/>
    <rect x="${c - 46 * s}" y="${c - 34 * s}" width="${64 * s}" height="${10 * s}" rx="${5 * s}" fill="${PAPER}" opacity="0.75"/>
    <circle cx="${c}" cy="${c + 34 * s}" r="${9 * s}" fill="${PAPER}" opacity="0.0"/>
  </svg>`;
}

async function gen(size, file, scale = 1) {
  await sharp(Buffer.from(svg(scale)))
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

await mkdir(outDir, { recursive: true });
await gen(192, 'icon-192.png', 1);
await gen(512, 'icon-512.png', 1);
await gen(512, 'maskable-512.png', 0.78); // maskable 安全区
await gen(180, 'apple-touch-icon.png', 1);
console.log('图标生成完成 →', outDir);
