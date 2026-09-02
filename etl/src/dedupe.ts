import type { Item } from './types.js';
import { normalizeUrl, normalizeTitle, md5 } from './util.js';

/**
 * 去重：URL 规范化（去追踪参数）+ 标题归一化后 MD5。
 * 支持用近 N 天历史条目预热（跨日窗口），避免重复推送。
 */
export class Deduper {
  private urlKeys = new Set<string>();
  private titleKeys = new Set<string>();
  /** 预热时见过的条目 id，用于区分"同一条的重跑"和"真正的重复内容" */
  private seededIds = new Set<string>();

  private urlKey(url: string): string {
    return md5(normalizeUrl(url));
  }

  private titleKey(title: string): string {
    return md5(normalizeTitle(title));
  }

  /** 用历史条目预热 */
  seed(items: Item[]): void {
    for (const it of items) {
      this.seededIds.add(it.id);
      this.urlKeys.add(this.urlKey(it.url));
      if (it.title) this.titleKeys.add(this.titleKey(it.title));
    }
  }

  isDuplicate(item: Item): boolean {
    // 同一条被重新抓到（当天第二次运行）不算重复：它会按 id 覆盖旧版本。
    // 不放行的话，预热包含当天分片会让当天所有后续运行都变成空转。
    if (this.seededIds.has(item.id)) return false;
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
