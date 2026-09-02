import { fetchBuffer } from './fetch.js';
import { config } from './config.js';
import { md5 } from './util.js';

/**
 * 下载封面图并转 webp。
 * 只对"已经在手上的候选 URL"调用 —— 不为了配图额外抓页面。
 * 调用方须先用 store.imageExists() 判断是否已存在，避免每轮重下重编码。
 */
export async function processImage(
  imgUrl: string,
): Promise<{ key: string; buf: Buffer } | null> {
  try {
    const { buf } = await fetchBuffer(imgUrl, {
      timeout: config.ogTimeout,
      retries: 0,
    });
    if (!buf || buf.length < 512) return null; // 过小，多半是占位图或错误页
    if (buf.length > 12 * 1024 * 1024) return null; // 过大，不值得为配图付这个成本

    let out: Buffer;
    try {
      const sharp = (await import('sharp')).default;
      out = await sharp(buf, { failOn: 'none' })
        .rotate()
        .resize({ width: config.imgMaxWidth, withoutEnlargement: true })
        .webp({ quality: config.imgQuality })
        .toBuffer();
    } catch {
      out = buf; // sharp 不可用则原样存储
    }
    return { key: `img/${md5(imgUrl)}.webp`, buf: out };
  } catch {
    return null;
  }
}
