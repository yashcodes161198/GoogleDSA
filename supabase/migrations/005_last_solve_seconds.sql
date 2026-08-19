ALTER TABLE user_problems
  ADD COLUMN IF NOT EXISTS last_solve_seconds INTEGER;
