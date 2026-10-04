-- Weekly leaderboard points. Events are append-only; the board sums the
-- current Asia/Kolkata week (Monday 00:00 through the next Monday 00:00).

CREATE TABLE IF NOT EXISTS leaderboard_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('solve', 'revision')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('MEDIUM', 'HARD')),
  revision_number INTEGER,
  points INTEGER NOT NULL CHECK (points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_events_shape CHECK (
    (event_type = 'solve' AND revision_number IS NULL)
    OR (event_type = 'revision' AND revision_number >= 1)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_events_solve_once
  ON leaderboard_events (user_id, problem_id)
  WHERE event_type = 'solve';

CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_events_revision_once
  ON leaderboard_events (user_id, problem_id, revision_number)
  WHERE event_type = 'revision';

CREATE INDEX IF NOT EXISTS idx_leaderboard_events_created_at
  ON leaderboard_events (created_at);

ALTER TABLE leaderboard_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read leaderboard events"
  ON leaderboard_events;
CREATE POLICY "Authenticated users can read leaderboard events"
  ON leaderboard_events FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON TABLE leaderboard_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE leaderboard_events TO authenticated;

CREATE OR REPLACE FUNCTION award_leaderboard_solve(p_problem_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_difficulty TEXT;
  v_points INTEGER;
  v_awarded INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT difficulty INTO v_difficulty
  FROM problems
  WHERE id = p_problem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Problem not found';
  END IF;

  IF v_difficulty = 'MEDIUM' THEN
    v_points := 4;
  ELSIF v_difficulty = 'HARD' THEN
    v_points := 8;
  ELSE
    RETURN 0;
  END IF;

  INSERT INTO leaderboard_events (
    user_id,
    problem_id,
    event_type,
    difficulty,
    revision_number,
    points
  )
  VALUES (v_user, p_problem_id, 'solve', v_difficulty, NULL, v_points)
  ON CONFLICT DO NOTHING
  RETURNING points INTO v_awarded;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN v_awarded;
END;
$$;

CREATE OR REPLACE FUNCTION award_leaderboard_revision(
  p_problem_id UUID,
  p_revision_number INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_difficulty TEXT;
  v_points INTEGER;
  v_awarded INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_revision_number IS NULL OR p_revision_number < 1 THEN
    RETURN 0;
  END IF;

  SELECT difficulty INTO v_difficulty
  FROM problems
  WHERE id = p_problem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Problem not found';
  END IF;

  IF v_difficulty = 'MEDIUM' THEN
    v_points := CASE WHEN p_revision_number = 1 THEN 2 ELSE 1 END;
  ELSIF v_difficulty = 'HARD' THEN
    v_points := CASE WHEN p_revision_number = 1 THEN 4 ELSE 2 END;
  ELSE
    RETURN 0;
  END IF;

  INSERT INTO leaderboard_events (
    user_id,
    problem_id,
    event_type,
    difficulty,
    revision_number,
    points
  )
  VALUES (
    v_user,
    p_problem_id,
    'revision',
    v_difficulty,
    p_revision_number,
    v_points
  )
  ON CONFLICT DO NOTHING
  RETURNING points INTO v_awarded;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN v_awarded;
END;
$$;

CREATE OR REPLACE FUNCTION get_weekly_leaderboard()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  points INTEGER,
  rank INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT timezone(
      'Asia/Kolkata',
      date_trunc('week', timezone('Asia/Kolkata', now()))
    ) AS week_start
  ),
  totals AS (
    SELECT e.user_id, SUM(e.points)::int AS points
    FROM leaderboard_events e
    CROSS JOIN bounds b
    WHERE e.created_at >= b.week_start
      AND e.created_at < b.week_start + interval '7 days'
    GROUP BY e.user_id
  )
  SELECT
    t.user_id,
    COALESCE(
      NULLIF(u.raw_user_meta_data->>'full_name', ''),
      NULLIF(u.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(u.email, '@', 1), ''),
      'Player'
    ) AS display_name,
    t.points,
    RANK() OVER (ORDER BY t.points DESC)::int AS rank
  FROM totals t
  JOIN auth.users u ON u.id = t.user_id
  ORDER BY t.points DESC, display_name ASC;
$$;

REVOKE ALL ON FUNCTION award_leaderboard_solve(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION award_leaderboard_revision(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_weekly_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION award_leaderboard_solve(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION award_leaderboard_revision(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_leaderboard() TO authenticated;
