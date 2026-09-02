// 与 ETL 数据契约一致的前端类型

export type ItemKind = 'deep' | 'keyword' | 'hot';
export type ImageSource =
  | 'media'
  | 'enclosure'
  | 'html-first-img'
  | 'og-image'
  | 'none';

export interface Item {
  id: string;
  sourceId: string;
  sourceName: string;
  kind: ItemKind;
  category: string;
  title: string;
  titleZh?: string;
  summary?: string;
  url: string;
  image?: string; // 形如 /data/img/{md5}.webp
  imageSource: ImageSource;
  publishedAt: number;
  contentLen: number;
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

export interface LatestIndex {
  generatedAt: number;
  categories: Record<string, string[]>;
  all: string[];
  itemCount: number;
  dates?: string[]; // R2 内存在的 items 日期分片（倒序）
}

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  type: 'rss' | 'gnews';
  category: string;
  kind: ItemKind;
  enabled: boolean;
  limit: number;
  expectedDomain?: string;
  offlineReading?: boolean;
  keywords?: string[];
}

export interface AppConfig {
  version: number;
  updatedAt: number;
  contentTypes: { deep: boolean; keyword: boolean; hot: boolean };
  settings: {
    density: 'compact' | 'standard';
    sort: 'time' | 'source';
    darkMode: 'system' | 'light' | 'dark';
    aiModel: string;
    summaryLength: number;
    autoTranslate: boolean;
    categoryOrder: string[];
  };
  sources: SourceConfig[];
}
