-- Revision tracking must be present before the revise action can increment a
-- user's count. Keep this migration idempotent so it also repairs projects
-- where migration 003 was skipped.
ALTER TABLE user_problems
  ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_revised_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_problems_revision
  ON user_problems(user_id, revision_count, last_revised_at);

-- Increment in the database so two rapid clicks cannot lose an increment.
CREATE OR REPLACE FUNCTION increment_user_problem_revision(
  p_problem_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  next_revision_count INTEGER;
BEGIN
  UPDATE user_problems
  SET
    revision_count = revision_count + 1,
    last_revised_at = now()
  WHERE user_id = auth.uid()
    AND problem_id = p_problem_id
    AND status = 'solved'
  RETURNING revision_count INTO next_revision_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only solved problems can be revised';
  END IF;

  RETURN next_revision_count;
END;
$$;

REVOKE ALL ON FUNCTION increment_user_problem_revision(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_user_problem_revision(UUID) TO authenticated;
