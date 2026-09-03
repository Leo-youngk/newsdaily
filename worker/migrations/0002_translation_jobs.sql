CREATE TABLE IF NOT EXISTS translation_jobs (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'queued',
  next_attempt INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_due
  ON translation_jobs(state, next_attempt, lease_until);
