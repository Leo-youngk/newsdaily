// 统一数据契约：与 plan.md 中的 Item schema 一致

export type ItemKind = 'deep' | 'keyword' | 'hot';
export type ImageSource =
  | 'media'
  | 'enclosure'
  | 'html-first-img'
  | 'og-image'
  | 'none';

export interface Item {
  id: string; // md5(sourceId + guid|url)
  sourceId: string;
  sourceName: string;
  kind: ItemKind;
  category: string;
  title: string;
  titleZh?: string; // AI 翻译后写入 D1 缓存，不改 JSON
  summary?: string; // feed 自带摘要，截断 200 字
  url: string; // 真实原文链接（Google News 已解包重定向）
  image?: string; // R2 图片 URL
  imageSource: ImageSource;
  publishedAt: number; // epoch ms
  contentLen: number; // 正文长度
  hot?: number;
  tags: string[];
}

export interface ItemDetail {
  id: string;
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  contentHtml: string;
  contentText: string;
  extractedAt: number;
}

export type SourceType = 'rss' | 'gnews';

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  category: string;
  kind: ItemKind;
  enabled: boolean;
  limit: number;
  expectedDomain?: string;
  offlineReading?: boolean;
  keywords?: string[];
}

export interface ContentTypes {
  deep: boolean;
  keyword: boolean;
  hot: boolean;
}

export interface AppSettings {
  density: 'compact' | 'standard';
  sort: 'time' | 'source';
  darkMode: 'system' | 'light' | 'dark';
  aiModel: string;
  summaryLength: number;
  autoTranslate: boolean;
  categoryOrder: string[];
}

export interface AppConfig {
  version: number;
  updatedAt: number;
  contentTypes: ContentTypes;
  settings: AppSettings;
  sources: SourceConfig[];
}

export interface SourceHealth {
  source_id: string;
  consecutive_fail: number;
  last_error: string;
  last_success: number;
}

export interface LatestIndex {
  generatedAt: number;
  categories: Record<string, string[]>; // category -> item ids
  all: string[]; // 全部 id，按时间倒序
  itemCount: number;
  dates: string[]; // 当前 R2 内存在的 items 日期分片（倒序），供前端精确拉取
}
