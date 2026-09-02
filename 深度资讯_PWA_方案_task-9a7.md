# 深度资讯 PWA 最终方案

## Summary

三层架构，全部落在免费额度内：

- 采集层：GitHub Actions（Node 20 + tsx），定时抓取 RSS 与 Google News 源，做正文提取、封面图兜底、图片转存、去重、关键词过滤，产物写入 Cloudflare R2
- 存储层：R2（JSON 产物 + webp 图片，零出口流量费）+ D1（AI 摘要缓存、用户配置、源健康度）
- 服务层：Cloudflare Worker（Hono，只做 AI 中继与配置读写，纯转发不吃 CPU）+ Pages（Vite/React 静态 PWA）

选择 Actions 而非 Workers 做重活的唯一原因：Workers 免费版每请求仅 10ms CPU，跑不了 XML 解析、Readability 正文提取和图片压缩；且 Workers 运行时没有 DOM，`@mozilla/readability` 无法使用。Actions 无 CPU 限制、public 仓库不限分钟数，且这是 TrendRadar（62k stars）与 daily_stock_analysis（64.5k stars）已验证的零成本模式。

## 实测数据源结论（已逐个 HTTP 验证）

关键发现：`rsshub.app` 公共实例实测不可用（连接失败），因此无官方 RSS 的站点改用 Google News RSS 的 `site:` 语法替代，实测 100% 可用。

| 源 | 地址 | 状态 | 条数 | 图片位置 |
| --- | --- | --- | --- | --- |
| IT之家 | `ithome.com/rss/` | 200 | 60 | description 内 203 个 img |
| 爱范儿 | `ifanr.com/feed` | 200 | 20 | description 内 481 个 img |
| 极客公园 | `geekpark.net/rss` | 200 | 30 | description 内 199 个 img |
| 钛媒体 | `tmtpost.com/rss.xml` | 200 | 17 | description 内 89 个 img |
| 阮一峰 | `ruanyifeng.com/blog/atom.xml` | 200 | - | Atom，228 个 img |
| BBC World | `feeds.bbci.co.uk/news/world/rss.xml` | 200 | 27 | 标准 media:content |
| FT中文网 | `ftchinese.com/rss/news` | 200 | - | 需 og:image 兜底 |
| V2EX | `v2ex.com/index.xml` | 200 | - | 需 og:image 兜底 |
| Hacker News | `hnrss.org/frontpage` | 200 | - | 需 og:image 兜底 |
| GitHub Blog | `github.blog/feed/` | 200 | - | 需 og:image 兜底 |
| OpenAI News | `openai.com/news/rss.xml` | 200 | - | 需 og:image 兜底 |
| HuggingFace | `huggingface.co/blog/feed.xml` | 200 | - | 需 og:image 兜底 |
| arXiv cs.AI | `rss.arxiv.org/rss/cs.AI` | 200 | - | 需 og:image 兜底 |
| 机器之心 | `jiqizhixin.com/rss` | 200 | Atom | 13 个 img |
| 少数派 | `sspai.com/feed` | 200 | 10 | 精简版无图，改走 gnews site: |
| 量子位 | `qbitai.com/feed` | 200 | 10 | 无图，og:image 兜底 |
| Solidot | `solidot.org/index.rss` | 200 | 20 | 无图，og:image 兜底 |
| 36氪 | `news.google.com/rss/search?q=site:36kr.com` | 200 | 100 | 无图，og:image 兜底 |
| 虎嗅 | `news.google.com/rss/search?q=site:huxiu.com` | 200 | 100 | 无图，og:image 兜底 |
| 自定义关键词 | `news.google.com/rss/search?q=<关键词>` | 200 | 100 | 无图，og:image 兜底 |
| 失效 | `36kr.com/feed`（返回 HTML）、`huxiu.com/rss/0.xml`（超时）、`theguardian.com/world/rss`（失败）、`cn.wsj.com`（401） | - | - | 已剔除 |

## 仓库结构

```
news-pwa/
├── app/                          # Vite + React + TS + Tailwind，部署 Cloudflare Pages
│   ├── src/
│   │   ├── components/
│   │   │   ├── cards/HeroCard.tsx    # 大图头条卡（16:9）
│   │   │   ├── cards/RowCard.tsx     # 左图右文卡（默认，1:1 缩略图）
│   │   │   ├── cards/TextCard.tsx    # 无图紧凑卡（降级）
│   │   │   ├── CategoryTabs.tsx      # 顶部横向分类 Tab
│   │   │   ├── SearchBar.tsx         # 实时过滤标题
│   │   │   ├── ReaderView.tsx        # 正文阅读页 + AI 摘要/翻译块
│   │   │   └── settings/SourceManager.tsx  # 源管理与自定义
│   │   ├── lib/r2.ts                 # 拉取 /data/* 索引与详情
│   │   ├── lib/filter.ts             # 关键词 DSL 客户端实现
│   │   ├── lib/ai.ts                 # 调 Worker /api/ai/*
│   │   └── lib/prefs.ts              # localStorage 偏好读写
│   ├── public/sw.js                  # 手写 Service Worker（shell + stale-while-revalidate）
│   ├── public/manifest.json
│   └── vite.config.ts
├── etl/                          # Actions 脚本
│   ├── src/{fetch,parse,extract,images,dedupe,filter,upload}.ts
│   ├── sources.seed.json         # 上表的种子源清单
│   └── package.json
├── worker/src/index.ts           # Hono：/api/ai/*, /api/config, /data/*
├── worker/migrations/0001_init.sql
├── .github/workflows/etl.yml
└── wrangler.jsonc
```

## 数据契约

统一 Item schema（借鉴 DailyHotApi 的 `pic` 字段设计并扩展）：

```ts
interface Item {
  id: string                    // md5(sourceId + guid|url)
  sourceId: string
  sourceName: string
  kind: 'deep' | 'keyword' | 'hot'
  category: string              // 科技/财经/AI/国际/开源，可在源配置里指定
  title: string
  titleZh?: string              // AI 翻译后写入 D1 缓存，不改 JSON
  summary?: string              // feed 自带摘要，截断 200 字
  url: string                   // 真实原文链接（Google News 已解包重定向）
  image?: string                // R2 图片 URL
  imageSource: 'media' | 'enclosure' | 'html-first-img' | 'og-image' | 'none'
  publishedAt: number
  contentLen: number            // 正文长度，详情页据此决定是否已提取
  hot?: number
  tags: string[]
}
```

R2 布局：

```
config/sources.json      # PWA 内改的订阅配置，Actions 每次运行先读它
index/latest.json        # 首页索引：分类 -> 条目 id 列表（不含正文）
items/2026-09-02.json    # 按日分片的条目元数据
detail/{id}.json         # 单条详情（含 Readability 提取的 contentHtml）
img/{md5}.webp           # 转存后的封面图
meta/health.json         # 源健康度（成功率、连续失败次数）
```

D1 表（`worker/migrations/0001_init.sql`）：

```sql
CREATE TABLE ai_cache (k TEXT PRIMARY KEY, kind TEXT, model TEXT, result TEXT, created_at INTEGER);
CREATE TABLE user_config (id INTEGER PRIMARY KEY CHECK (id=1), json TEXT, updated_at INTEGER);
CREATE TABLE source_health (source_id TEXT PRIMARY KEY, consecutive_fail INTEGER, last_error TEXT, last_success INTEGER);
```

## 采集流水线（etl/，Actions 运行）

1. 读配置：先从 R2 拉 `config/sources.json`（用户在 PWA 里的勾选结果），缺失则用 `sources.seed.json`
2. 并发抓取：`p-limit` 控制 5 并发，单源超时 15s，随机浏览器 UA，失败重试 1 次；失败源写入 `source_health`，连续失败 5 次的源自动跳过并在下次运行时降频（借鉴 NewsNow 的自适应抓取间隔思路）
3. 解析：`rss-parser` 处理 RSS 2.0 与 Atom（机器之心、阮一峰是 Atom）
4. 封面图五级回退：`media:content` / `media:thumbnail` → `enclosure` → description 或 content:encoded 内首个 `img` → 抓原文页解析 `og:image`/`twitter:image` → 标记 `none`（前端渲染 TextCard）。og:image 抓取仅对无图源执行，并发 3，超时 8s
5. Google News 链接解包：`news.google.com/rss/articles/...` 需跟随重定向取真实 URL，解析失败时保留原链接并标记；同一 URL 去重
6. 正文提取：`@mozilla/readability` + `linkedom`（Node 环境有 DOM 实现），仅对 `kind=deep` 且用户开启"离线阅读"的源执行，结果写 `detail/{id}.json`
7. 图片转存：`sharp` 统一转 webp、宽度上限 800px、质量 78，key 为 `img/{md5}.webp`，已存在则跳过（省 Class A 操作）
8. 去重：URL 规范化（去 utm 等追踪参数）+ 标题归一化后 MD5，跨日窗口 7 天
9. 关键词过滤（TrendRadar DSL 子集，在 `config/sources.json` 的 `keywords` 字段）：
   - 普通词：命中任一即保留
   - `+词`：必须词，必须同时命中
   - `!词`：排除词，命中即丢弃
   - `@N`：每源最多保留 N 条
   - 留空表示不过滤，全量保留
10. 安全校验：校验条目链接域名与源声明的 `expectedDomain` 一致，不一致则丢弃并记录（借鉴 TrendRadar 的防链接劫持设计）
11. 上传：写 `items/{date}.json`、重建 `index/latest.json`、上传新图片、更新 `meta/health.json`
12. 保留策略：删除 30 天前的 `items/*.json` 与 `detail/*.json`，图片按引用计数清理

`.github/workflows/etl.yml`：`schedule` 每 2 小时一次 + `workflow_dispatch` 手动触发；secrets 需要 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`。仓库设为 public 可完全绕开 Actions 分钟数限制（private 也有 2000 分钟/月，实测每次运行约 2-3 分钟，每月 360 次约 900 分钟，同样够用）。

## Worker（worker/src/index.ts，Hono）

CPU 消耗极低（全是 I/O 转发与 R2/D1 读取），10ms 限制无压力：

- `GET /data/*`：从 R2 读取并透传 JSON，配 `Cache-Control: s-maxage=300`，让 Cloudflare CDN 承担绝大部分读取。前端与数据同源，避免 CORS
- `POST /api/ai/summary`：入参 `{ id, text }`，先查 D1 `ai_cache`（key = `sum:{id}`），未命中则调用用户配置的 OpenAI 兼容端点，结果写回 D1 后返回
- `POST /api/ai/translate`：同上，key = `tr:{id}`，支持标题与正文两种粒度
- `GET/PUT /api/config`：读写用户订阅配置，PUT 时同时写 D1 `user_config` 与 R2 `config/sources.json`，供下次 Actions 运行读取；用 `x-admin-token` 头做简单鉴权（个人使用）
- Provider 抽象：借鉴 Karakeep 的 `InferenceClientFactory` 与 LiteLLM 的 `fallback_models`，配置 `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` / `AI_FALLBACK_MODEL`，主模型失败自动切备用模型，全部存 Workers Secret

AI 提示词（`worker/src/prompts.ts`）：
- 摘要：要求输出 2-4 句中文，覆盖核心事实与结论，不添加原文没有的信息，不超过 180 字
- 翻译：科技/财经术语保留通用中文译法，专有名词首次出现附原文

## 前端与排版规格（app/）

- 三种卡片模板：HeroCard（首条或用户标星，16:9 大图 + 标题 + 来源时间）、RowCard（默认，左侧 1:1 缩略图 + 右侧两行标题 + 摘要一行 + 来源）、TextCard（无图降级，纯文字 + 分类色点）
- 顶部横向滚动分类 Tab（全部 / 科技 / 财经 / AI / 国际 / 开源 / 自定义），顺序可在设置里调整
- 搜索框实时过滤标题（借鉴 TrendRadar HTML 报告的搜索交互）
- 长列表用 `@tanstack/react-virtual` 虚拟滚动，图片 `loading=lazy` + 占位骨架
- 阅读页：Readability 提取的正文（若已离线化）或原文摘要 + 跳转原文；顶部 AI 操作条（生成摘要 / 翻译标题 / 翻译全文），结果缓存后二次打开免调用
- 视觉基调参考 glance 的克制风格：16px 圆角、充足留白、无广告位、无推荐位、暗色模式跟随系统 + 手动切换
- PWA：手写 `sw.js`（沿用你已验证的方案，不用 next-pwa），缓存策略为 app shell 预缓存 + `/data/*` stale-while-revalidate + 图片 cache-first；`manifest.json` 配 192/512/apple-touch-icon 图标；移动端底部 Tab（资讯 / 收藏 / 设置）+ 安全区适配
- 收藏与已读状态存 localStorage（不占 D1 写额度）

## PWA 内自定义（核心需求实现）

设置页四个分区，全部改动通过 `PUT /api/config` 写回云端，下次 Actions 运行生效（UI 明确显示"将于下次抓取生效，约 X 分钟后"）：

1. 内容类型：深度资讯 / 关键词源 / 热榜（热榜默认关闭）三类总开关
2. 源管理：按分类分组的开关列表，每源可设条数上限；支持"添加自定义 RSS URL"；支持"添加 Google News 关键词源"（输入关键词即生成 `site:` 或主题搜索源，这是实现"我想看什么类型"最灵活的手段）
3. 关键词过滤：TrendRadar DSL 子集编辑框（普通词 / `+`必须 / `!`排除 / `@`条数），带实时语法校验与命中预览
4. 显示与 AI：排版密度（紧凑/标准）、排序（时间/来源）、暗色模式、AI 模型名、摘要长度、是否自动翻译英文标题

热榜为可选项：若开启，需自部署 NewsNow（MIT，官方支持 Cloudflare Pages + D1）到同一账号，Actions 抓其 API 作为 `kind=hot` 数据；不自部署则该分类不显示。

## 免费额度核算

| 服务 | 免费额度 | 本项目预估用量 | 结论 |
| --- | --- | --- | --- |
| GitHub Actions | public 仓库不限分钟 | 每 2 小时一次，约 900 分钟/月 | 充裕 |
| R2 存储 | 10 GB/月 | 图片约 2 GB（30 天保留策略） | 充裕 |
| R2 Class A（写） | 100 万次/月 | 约 8 万次/月 | 充裕 |
| R2 Class B（读） | 1000 万次/月 | 主要由 CDN 缓存吸收 | 充裕 |
| R2 出口流量 | 0 美元 | - | 免费 |
| D1 | 5 GB / 500 万行读 / 10 万行写每日 | AI 缓存 + 配置，极低 | 充裕 |
| Workers | 10 万请求/天 | 每天约 200-2000 请求 | 充裕 |
| Pages | 带宽与请求无限制，500 次构建/月 | 静态站 | 充裕 |

## 实施阶段

- Phase 0 数据层验证：`etl/` 脚本跑通 3 个带图源 + 2 个 Google News 源，本地输出 JSON，确认封面图五级回退与 Google News 链接解包可用。验收：本地生成含有效 `image` 字段的 items JSON，图片可访问
- Phase 1 R2 + Actions 全链路：接入 R2 SDK 与 sharp 图片转存，写 workflow，跑通定时任务与 30 天保留策略。验收：R2 桶内出现 index/items/detail/img 四类产物，Actions 连续 3 次定时运行成功
- Phase 2 Worker + D1：实现 `/data/*`、`/api/ai/*`、`/api/config`，建 D1 表，配置 Secrets。验收：curl 能取到索引 JSON，AI 摘要与翻译返回结果且二次请求命中缓存
- Phase 3 前端 PWA：Vite + React + Tailwind 搭建，三种卡片、分类 Tab、搜索、阅读器、设置页、手写 SW，部署 Pages。验收：手机添加到主屏幕可离线打开，源开关改动写回 R2 并在下次 Actions 运行后生效

## Assumptions

- R2 开通需要绑定外币卡或 PayPal（不会扣费，但必须有卡）。若不接受，退化方案是把 JSON 产物改存 D1 + Pages 构建时内联，图片改为直连原图 URL（防盗链风险上升）
- 仓库建议设为 public 以获得无限 Actions 分钟数；若必须 private，2000 分钟/月也够用
- AI 完全按需触发（点开文章或点按钮），不做批量预生成，因此 token 成本由你的使用量决定，架构上不产生固定开销
- 协议策略：GPL/AGPL 项目（TrendRadar、RSSHub、glance、Folo、Karakeep、FreshRSS）只借鉴设计思路，不复用代码；实际依赖全部为宽松协议（rss-parser、@mozilla/readability Apache-2.0、sharp、Hono MIT、React MIT、Tailwind MIT）
- 内容仅用于个人阅读聚合，保留来源标注与原文链接，正文离线缓存遵循 30 天保留策略
- 需要你提供：GitHub 仓库、Cloudflare 账号下的 R2 桶与 D1 库、AI 的 base URL / API Key / 模型名，以及对种子源清单的增删确认