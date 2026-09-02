-- D1 初始化：AI 摘要缓存、用户配置、源健康度
CREATE TABLE IF NOT EXISTS ai_cache (
  k TEXT PRIMARY KEY,
  kind TEXT,
  model TEXT,
  result TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  json TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS source_health (
  source_id TEXT PRIMARY KEY,
  consecutive_fail INTEGER DEFAULT 0,
  last_error TEXT DEFAULT '',
  last_success INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_created ON ai_cache (created_at);
