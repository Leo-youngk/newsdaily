import { fetchBuffer, fetchText } from './fetch.js';
import { config } from './config.js';
import { md5, firstImgSrc, decodeEntities } from './util.js';
import type { ImageSource } from './types.js';
import type { RawEntry } from './parse.js';

export interface CoverCandidate {
  url?: string;
  imageSource: ImageSource;
}

/** 封面图五级回退的前四级（第五级 none 由调用方处理） */
export function pickCoverFromEntry(entry: RawEntry): CoverCandidate {
  // 1. media:content / media:thumbnail
  if (entry.mediaImages.length) {
    return { url: entry.mediaImages[0], imageSource: 'media' };
  }
  // 2. enclosure
  if (entry.enclosureImage) {
    return { url: entry.enclosureImage, imageSource: 'enclosure' };
  }
  // 3. description / content:encoded 内首个 img
  const inline = firstImgSrc(entry.contentHtml);
  if (inline) {
    return { url: inline, imageSource: 'html-first-img' };
  }
  return { imageSource: 'none' };
}

/** 第四级：抓原文页解析 og:image / twitter:image（仅对无图源执行） */
export async function fetchOgImage(pageUrl: string): Promise<string | undefined> {
  try {
    const html = await fetchText(pageUrl, {
      timeout: config.ogTimeout,
      retries: 0,
    });
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) {
        let url = decodeEntities(m[1]).trim();
        if (url.startsWith('//')) url = 'https:' + url;
        if (/^https?:\/\//i.test(url)) return url;
      }
    }
  } catch {
    /* ignore，回退 none */
  }
  return undefined;
}

export interface StoredImage {
  key: string; // img/{md5}.webp
  bytes: number;
  skipped: boolean; // 已存在，未重复上传
}

/**
 * 下载原图并转 webp（宽度上限、质量），返回 R2 key 与二进制。
 * 失败返回 null（调用方回退 none 或原图直链）。
 */
export async function processImage(
  imgUrl: string,
): Promise<{ key: string; buf: Buffer } | null> {
  try {
    const { buf } = await fetchBuffer(imgUrl, {
      timeout: config.ogTimeout,
      retries: 0,
    });
    if (!buf || buf.length < 512) return null; // 过小，可能是占位图/错误页
    // 动态 import sharp，缺失时降级为直存原图
    let out: Buffer;
    try {
      const sharp = (await import('sharp')).default;
      out = await sharp(buf, { failOn: 'none' })
        .rotate() // 依据 EXIF 方向
        .resize({ width: config.imgMaxWidth, withoutEnlargement: true })
        .webp({ quality: config.imgQuality })
        .toBuffer();
    } catch {
      out = buf; // sharp 不可用则原样存储
    }
    const key = `img/${md5(imgUrl)}.webp`;
    return { key, buf: out };
  } catch {
    return null;
  }
}
