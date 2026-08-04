-- Revision tracking for round-robin daily revise queue
ALTER TABLE user_problems
  ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_revised_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_problems_revision
  ON user_problems(user_id, revision_count, last_revised_at);
