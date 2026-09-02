import type { Item } from './types.js';
import { normalizeUrl, normalizeTitle, md5 } from './util.js';

/**
 * 去重：URL 规范化（去追踪参数）+ 标题归一化后 MD5。
 * 支持用近 N 天历史条目预热（跨日窗口），避免重复推送。
 */
export class Deduper {
  private urlKeys = new Set<string>();
  private titleKeys = new Set<string>();

  private urlKey(url: string): string {
    return md5(normalizeUrl(url));
  }

  private titleKey(title: string): string {
    return md5(normalizeTitle(title));
  }

  /** 用历史条目预热 */
  seed(items: Item[]): void {
    for (const it of items) {
      this.urlKeys.add(this.urlKey(it.url));
      if (it.title) this.titleKeys.add(this.titleKey(it.title));
    }
  }

  isDuplicate(item: Item): boolean {
    const uk = this.urlKey(item.url);
    if (this.urlKeys.has(uk)) return true;
    const tk = this.titleKey(item.title);
    // 标题去重仅在同一分类内更稳妥，但跨源同题也应合并
    if (this.titleKeys.has(tk)) return true;
    return false;
  }

  add(item: Item): void {
    this.urlKeys.add(this.urlKey(item.url));
    if (item.title) this.titleKeys.add(this.titleKey(item.title));
  }

  /** 过滤一批条目，返回未重复的，并把它们登记 */
  dedupe(items: Item[]): Item[] {
    const out: Item[] = [];
    for (const it of items) {
      if (this.isDuplicate(it)) continue;
      this.add(it);
      out.push(it);
    }
    return out;
  }
}
