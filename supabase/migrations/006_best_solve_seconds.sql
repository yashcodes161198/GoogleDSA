ALTER TABLE user_problems
  ADD COLUMN IF NOT EXISTS best_solve_seconds INTEGER;
