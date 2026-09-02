// 与 etl/src/types.ts 保持一致的数据契约

export type Category = '访谈' | 'AI' | '科技' | '商业' | '思想';

export const CATEGORIES: Category[] = ['访谈', 'AI', '科技', '商业', '思想'];

export type Lang = 'zh' | 'en';

export type Readable = 'full' | 'transcript' | 'extract';

export type ContentSource =
  | 'feed'
  | 'transcript-tag'
  | 'transcript-page'
  | 'extract'
  | 'none';

export interface TranscriptRule {
  from?: string;
  to?: string;
}

export interface SourceConfig {
  id: string;
  name: string;
  url: string;
  category: Category;
  lang: Lang;
  readable: Readable;
  transcript?: TranscriptRule;
  enabled: boolean;
  limit: number;
  minChars: number;
  dropUnreadable?: boolean;
  expectedDomain?: string;
  keywords?: string[];
  note?: string;
}

export interface Item {
  id: string;
  sourceId: string;
  sourceName: string;
  category: Category;
  lang: Lang;
  title: string;
  titleZh?: string;
  summary?: string;
  url: string;
  image?: string;
  publishedAt: number;
  contentLen: number;
  contentSource: ContentSource;
  readingMinutes: number;
  audioUrl?: string;
  durationSec?: number;
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
  contentSource: ContentSource;
  extractedAt: number;
}

export interface AppSettings {
  density: 'compact' | 'standard';
  sort: 'time' | 'source';
  darkMode: 'system' | 'light' | 'dark';
  autoTranslate: boolean;
  categoryOrder: Category[];
}

export interface AppConfig {
  version: number;
  updatedAt: number;
  categories: Record<Category, boolean>;
  settings: AppSettings;
  sources: SourceConfig[];
}

export interface LatestIndex {
  generatedAt: number;
  categories: Record<string, string[]>;
  all: string[];
  itemCount: number;
  dates: string[];
  readableRate: number;
}

/** 这条内容是不是逐字稿（决定卡片与阅读页的呈现方式） */
export function isTranscript(item: Item): boolean {
  return item.contentSource === 'transcript-tag' || item.contentSource === 'transcript-page';
}
