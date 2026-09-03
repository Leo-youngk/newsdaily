-- 标题译文独立于采集分片，以原文内容寻址；租约保证并发任务不重复生成。
CREATE TABLE IF NOT EXISTS title_translations (
  hash TEXT PRIMARY KEY,
  original TEXT NOT NULL,
  text TEXT,
  model TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  error TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_title_translations_due
  ON title_translations(next_attempt, lease_until) WHERE text IS NULL;
