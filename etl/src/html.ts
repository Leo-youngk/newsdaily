import { parseHTML } from 'linkedom';

/** 允许保留的标签，其余一律解包（保留文字，去掉标签本身） */
const KEEP = new Set([
  'P', 'BR', 'HR',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI',
  'BLOCKQUOTE', 'PRE', 'CODE',
  'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUP', 'SUB',
  'A', 'IMG', 'FIGURE', 'FIGCAPTION',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'DL', 'DT', 'DD',
]);

/** 整棵子树都要删掉的标签 */
const DROP = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET',
  'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'SVG', 'CANVAS',
  'AUDIO', 'VIDEO', 'SOURCE', 'TRACK', 'LINK', 'META', 'BASE',
]);

/** 每个标签允许保留的属性 */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'title']),
  IMG: new Set(['src', 'alt', 'width', 'height']),
  TD: new Set(['colspan', 'rowspan']),
  TH: new Set(['colspan', 'rowspan']),
};

function safeUrl(raw: string | null, base: string): string | null {
  if (!raw) return null;
  const v = raw.trim();
  // 只放行 http(s) 与内联图片，挡掉 javascript: / vbscript: / data:text-html 等
  if (/^(javascript|vbscript|file):/i.test(v)) return null;
  if (/^data:/i.test(v)) return /^data:image\//i.test(v) ? v : null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}

/**
 * 清洗提取出来的正文 HTML：
 *   1. 删掉脚本类整棵子树
 *   2. 剥掉所有事件属性（onerror/onclick…）与 style/class
 *   3. 把相对 href/src 按原文 URL 转成绝对（原来漏了这步，正文里的图和链接全是坏的）
 *   4. 外链一律 target=_blank + rel=noopener，避免把 PWA 顶掉
 * 返回清洗后的 HTML 与对应纯文本。
 */
export function cleanContentHtml(
  html: string,
  baseUrl: string,
): { html: string; text: string } {
  if (!html) return { html: '', text: '' };
  const { document } = parseHTML(`<div id="__root">${html}</div>`);
  const root = document.getElementById('__root');
  if (!root) return { html: '', text: '' };

  // 先删整棵子树
  for (const el of Array.from(root.querySelectorAll([...DROP].join(',')) as any) as any[]) {
    el.remove();
  }

  const walk = (el: any): void => {
    for (const child of [...el.children]) walk(child);
    const tag = el.tagName as string;

    // 属性白名单：先无条件干掉所有 on* 与 style/class
    for (const attr of [...el.attributes].map((a: any) => a.name)) {
      const allowed = ALLOWED_ATTRS[tag];
      if (!allowed || !allowed.has(attr.toLowerCase())) {
        el.removeAttribute(attr);
      }
    }

    if (tag === 'A') {
      const href = safeUrl(el.getAttribute('href'), baseUrl);
      if (href) {
        el.setAttribute('href', href);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      } else {
        el.removeAttribute('href');
      }
    } else if (tag === 'IMG') {
      const src = safeUrl(el.getAttribute('src'), baseUrl);
      if (!src) {
        el.remove();
        return;
      }
      el.setAttribute('src', src);
      el.setAttribute('loading', 'lazy');
      el.setAttribute('decoding', 'async');
    }

    // 非白名单标签：解包，保留其中的文字与子节点
    if (!KEEP.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        el.remove();
      }
    }
  };
  for (const child of Array.from(root.children as any) as any[]) walk(child);

  const cleaned = root.innerHTML.replace(/\s+/g, ' ').trim();
  const text = (root.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { html: cleaned, text };
}

/** 从任意 HTML 里取纯文本（用于摘要） */
export function htmlToText(html: string): string {
  if (!html) return '';
  const { document } = parseHTML(`<div id="__r">${html}</div>`);
  const r = document.getElementById('__r');
  for (const el of Array.from((r?.querySelectorAll('script,style') ?? []) as any) as any[]) el.remove();
  return (r?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const VTT_CUE = /^\d{1,2}:\d{2}(:\d{2})?[.,]\d{3}\s*-->/;
const SRT_INDEX = /^\d+$/;

/**
 * 把 <podcast:transcript> 拿到的文稿文件转成可读 HTML。
 * 支持 text/plain、text/vtt、application/x-subrip(srt)、application/json、text/html。
 */
export function transcriptToHtml(
  raw: string,
  type: string,
  baseUrl: string,
): { html: string; text: string } {
  const t = (type || '').toLowerCase();

  if (t.includes('html')) return cleanContentHtml(raw, baseUrl);

  if (t.includes('json')) {
    try {
      const j = JSON.parse(raw);
      // Podcasting 2.0 JSON 文稿格式：{ version, segments: [{ speaker, startTime, body }] }
      const segs: any[] = j?.segments ?? j?.results ?? [];
      const lines: string[] = [];
      let lastSpeaker = '';
      let buf: string[] = [];
      const flush = () => {
        if (!buf.length) return;
        const body = buf.join(' ').trim();
        lines.push(lastSpeaker ? `<p><strong>${esc(lastSpeaker)}：</strong>${esc(body)}</p>` : `<p>${esc(body)}</p>`);
        buf = [];
      };
      for (const s of segs) {
        const speaker = String(s?.speaker ?? '').trim();
        const body = String(s?.body ?? s?.text ?? '').trim();
        if (!body) continue;
        if (speaker !== lastSpeaker) {
          flush();
          lastSpeaker = speaker;
        }
        buf.push(body);
      }
      flush();
      if (lines.length) {
        const html = lines.join('');
        return { html, text: htmlToText(html) };
      }
    } catch {
      /* 落到纯文本分支 */
    }
  }

  // vtt / srt / plain：逐行清掉时间轴与序号，再按空行合段
  const lines = raw.split(/\r?\n/);
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      kept.push('');
      continue;
    }
    if (line === 'WEBVTT' || line.startsWith('NOTE ') || line.startsWith('STYLE')) continue;
    if (VTT_CUE.test(line)) continue;
    if (SRT_INDEX.test(line) && VTT_CUE.test((lines[i + 1] ?? '').trim())) continue;
    kept.push(line.replace(/<\/?[cv][^>]*>/g, '')); // 去掉 vtt 内联的说话人标记
  }

  const paras: string[] = [];
  let buf: string[] = [];
  for (const l of kept) {
    if (!l) {
      if (buf.length) {
        paras.push(buf.join(' '));
        buf = [];
      }
    } else {
      buf.push(l);
    }
  }
  if (buf.length) paras.push(buf.join(' '));

  // 纯文本文稿常常整段没有空行，按句子数再切一次，避免出现一坨几万字的 <p>
  const chunks: string[] = [];
  for (const p of paras) {
    const clean = p.replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    if (clean.length <= 1200) {
      chunks.push(clean);
      continue;
    }
    const sentences = clean.match(/[^.!?。！？]+[.!?。！？]+|\S+$/g) ?? [clean];
    let cur = '';
    for (const s of sentences) {
      if ((cur + s).length > 800 && cur) {
        chunks.push(cur.trim());
        cur = '';
      }
      cur += s;
    }
    if (cur.trim()) chunks.push(cur.trim());
  }

  const html = chunks.map((c) => `<p>${esc(c)}</p>`).join('');
  return { html, text: chunks.join('\n\n') };
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
