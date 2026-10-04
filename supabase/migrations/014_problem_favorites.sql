ALTER TABLE user_problems
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_problems_favorites
  ON user_problems(user_id)
  WHERE is_favorite;
