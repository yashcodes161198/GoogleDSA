-- Track every revision increment, including repeated revisions of one problem.
ALTER TABLE user_problems
  ADD COLUMN IF NOT EXISTS daily_revision_count INTEGER NOT NULL DEFAULT 0
    CHECK (daily_revision_count >= 0);

-- Preserve the known history. A timestamp alone proves one revision; leaderboard
-- events recover repeated revisions when that history is available.
UPDATE user_problems
SET daily_revision_count = 1
WHERE last_revised_at IS NOT NULL AND daily_revision_count = 0;

DO $$
BEGIN
  IF to_regclass('public.leaderboard_events') IS NOT NULL THEN
    UPDATE user_problems up
    SET daily_revision_count = GREATEST(up.daily_revision_count, history.count)
    FROM (
      SELECT user_id, problem_id,
        (created_at AT TIME ZONE 'Asia/Kolkata')::date AS revision_day,
        COUNT(*)::integer AS count
      FROM leaderboard_events
      WHERE event_type = 'revision'
      GROUP BY user_id, problem_id, revision_day
    ) history
    WHERE up.user_id = history.user_id
      AND up.problem_id = history.problem_id
      AND (up.last_revised_at AT TIME ZONE 'Asia/Kolkata')::date = history.revision_day;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION track_daily_problem_revisions()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  increment INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    increment := NEW.revision_count;
    NEW.daily_revision_count := 0;
  ELSE
    increment := NEW.revision_count - OLD.revision_count;
    NEW.daily_revision_count := OLD.daily_revision_count;
  END IF;

  IF increment > 0 THEN
    IF TG_OP = 'UPDATE' THEN
      IF (OLD.last_revised_at AT TIME ZONE 'Asia/Kolkata')::date
          IS DISTINCT FROM (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
        NEW.daily_revision_count := 0;
      END IF;
    END IF;
    NEW.daily_revision_count := NEW.daily_revision_count + increment;
    NEW.last_revised_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_daily_problem_revisions ON user_problems;
CREATE TRIGGER track_daily_problem_revisions
  BEFORE INSERT OR UPDATE OF revision_count ON user_problems
  FOR EACH ROW EXECUTE FUNCTION track_daily_problem_revisions();
