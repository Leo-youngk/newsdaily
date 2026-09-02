// 统一数据契约：深度阅读器（长文 / 访谈逐字稿），不是快讯聚合器

/** 内容分类：按"读起来是什么体验"分，而不是按新闻条线分 */
export type Category = '访谈' | 'AI' | '科技' | '商业' | '思想';

export const CATEGORIES: Category[] = ['访谈', 'AI', '科技', '商业', '思想'];

export type Lang = 'zh' | 'en';

/**
 * 可读等级：决定这个源走哪条采集管线，也是本项目的核心指标来源。
 *   full       feed 的 content:encoded 就是全文，零抓取成本
 *   transcript 播客，已有现成逐字稿：先看 <podcast:transcript> 标签，再按规则推文稿页
 *   extract    只有摘要，需要抓原文页并做正文提取
 *   transcribe 播客且没有任何现成文字稿（中文播客全是这种）：入队，由
 *              transcribe 工作流用 Cloudflare Workers AI 的 whisper 异步转写
 */
export type Readable = 'full' | 'transcript' | 'extract' | 'transcribe';

/** 正文最终从哪儿来的，用于统计可读率与前端标注 */
export type ContentSource =
  | 'feed' // feed 自带全文
  | 'transcript-tag' // <podcast:transcript> 直链
  | 'transcript-page' // 按规则推出的文稿页
  | 'transcript-whisper' // 我们自己转写的
  | 'extract' // 原文页提取
  | 'pending-transcript' // 已入队，等待转写
  | 'none'; // 没拿到，只有摘要

export interface TranscriptRule {
  /** 用正则从单集页 URL 推出文稿页 URL；from 是完整匹配式，to 支持 $1 */
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
  /** readable=transcript 时的文稿页推导规则；没有则只依赖 <podcast:transcript> 标签 */
  transcript?: TranscriptRule;
  enabled: boolean;
  /** 每次运行从该源最多保留几条 */
  limit: number;
  /**
   * 正文低于这个字符数就视为"没拿到全文"，只留摘要。
   * 逐字稿类给高一点（防止只抓到 shownotes），长文类给低一点。
   */
  minChars: number;
  /**
   * 拿不到全文时是否直接丢弃该条，默认 true。
   * 深度阅读器里出现"点开读不了"的卡片就是失信，宁可少几条。
   * 只有确实想看标题流的源才设 false。
   */
  dropUnreadable?: boolean;
  /** 防链接劫持：条目域名须匹配；聚合型源（HN 等）留空表示不校验 */
  expectedDomain?: string;
  keywords?: string[];
  /** 备注：为什么选它 / 已知限制，纯给人看 */
  note?: string;
}

export interface Item {
  id: string; // md5(sourceId + guid|url)
  sourceId: string;
  sourceName: string;
  category: Category;
  lang: Lang;
  title: string;
  titleZh?: string;
  summary?: string;
  url: string;
  image?: string; // 可选，图片不是必需品
  publishedAt: number;
  /** 正文字符数，0 表示没拿到全文 */
  contentLen: number;
  contentSource: ContentSource;
  /** 预计阅读分钟数（中文 400 字/分，英文 240 词/分） */
  readingMinutes: number;
  /** 播客音频直链与时长，有则前端出播放器 */
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
  /** 分类级总开关：关掉的分类下所有源都不采集 */
  categories: Record<Category, boolean>;
  settings: AppSettings;
  sources: SourceConfig[];
}

/** 待转写队列里的一项 */
export interface TranscribeTask {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  audioUrl: string;
  lang: Lang;
  /** 条目所在的日期分片，转写完成后要回填它 */
  date: string;
  durationSec?: number;
  enqueuedAt: number;
  /** 失败次数，超过阈值放弃，避免一条坏音频反复烧额度 */
  attempts: number;
  lastError?: string;
}

export interface TranscribeQueue {
  updatedAt: number;
  tasks: TranscribeTask[];
  /**
   * 当日已消耗的音频分钟数。Workers AI 的免费额度按 UTC 天重置，
   * 所以这里记 UTC 日期；跨天自动归零。
   * 每次运行的预算管不住每天的总量（cron 一天跑 4 次），必须按天记账。
   */
  usage?: { utcDate: string; minutes: number };
}

export interface SourceHealth {
  source_id: string;
  consecutive_fail: number;
  last_error: string;
  last_success: number;
  /** 上次运行该源的可读率（拿到全文的条数 / 总条数） */
  last_readable_rate: number;
}

export interface LatestIndex {
  generatedAt: number;
  categories: Record<string, string[]>; // category -> item ids
  all: string[];
  itemCount: number;
  dates: string[];
  /** 全局可读率，这是本项目的北极星指标 */
  readableRate: number;
}
