export interface TranslationUnit { key: string; text: string }
export interface ReaderDocument { html: string; revision: string; units: TranslationUnit[] }
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,dt,dd,th,td';
const SKIP = 'pre,code,script,style,img,svg,audio,video';

function splitText(text: string): string[] {
  const parts: string[] = [];
  while (text.length) {
    let end = Math.min(3000, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > 1500) end = space;
    }
    const part = text.slice(0, end).trim();
    if (part) parts.push(part);
    text = text.slice(end).trimStart();
  }
  return parts;
}
export async function createReaderDocument(html: string): Promise<ReaderDocument> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const units: TranslationUnit[] = [];
  let block = 0;
  const mark = (el: Element) => {
    const clone = el.cloneNode(true) as Element;
    clone.querySelectorAll('.ts').forEach((ts) => ts.remove());
    const text = clone.textContent?.trim();
    if (!text) return;
    const key = String(block++);
    el.setAttribute('data-translation-block', key);
    splitText(text).forEach((part, i) => units.push({ key: `${key}.${i}`, text: part }));
  };
  const visit = (el: Element) => {
    if (el.matches(SKIP) || el.matches('.ts')) return;
    if (el.matches(BLOCKS) && !el.querySelector(`${BLOCKS},${SKIP}`)) { mark(el); return; }
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
        const span = doc.createElement('span');
        child.replaceWith(span);
        span.appendChild(child);
        mark(span);
      } else if (child.nodeType === Node.ELEMENT_NODE) visit(child as Element);
    }
  };
  visit(doc.body);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`reader-v2:${html}`));
  const revision = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { html: doc.body.innerHTML, revision, units };
}
export function translatedHtml(source: ReaderDocument, translations: Record<string, { text?: string }>, mode: 'bilingual' | 'zh'): string {
  const doc = new DOMParser().parseFromString(source.html, 'text/html');
  const parts = new Map<string, TranslationUnit[]>();
  for (const unit of source.units) {
    const block = unit.key.split('.')[0];
    parts.set(block, [...(parts.get(block) ?? []), unit]);
  }
  for (const el of Array.from(doc.querySelectorAll('[data-translation-block]'))) {
    const units = parts.get(el.getAttribute('data-translation-block')!) ?? [];
    if (units.length && units.every((unit) => !!translations[unit.key]?.text)) {
      const text = units.map((unit) => translations[unit.key].text).join(' ');
      if (mode === 'zh') {
        const timestamp = el.querySelector('.ts')?.cloneNode(true);
        el.textContent = text;
        if (timestamp) el.prepend(timestamp);
      } else {
        const translated = doc.createElement('span');
        translated.className = 'translation-text';
        translated.textContent = text;
        el.append(translated);
      }
    } else {
      const note = doc.createElement('span');
      note.className = 'translation-pending';
      note.textContent = '原文 · 等待自动补译';
      el.append(note);
    }
  }
  return doc.body.innerHTML;
}
