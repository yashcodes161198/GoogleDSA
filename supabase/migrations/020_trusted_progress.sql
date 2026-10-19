-- All authoritative progress and awards share one transaction and one user lock.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.problem_award_state (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
  solved BOOLEAN NOT NULL DEFAULT false,
  revision_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, problem_id)
);
INSERT INTO private.problem_award_state (user_id, problem_id, solved, revision_count)
SELECT user_id, problem_id, bool_or(solved), max(revision_count)
FROM (
  SELECT user_id, problem_id, status = 'solved' OR solved_at IS NOT NULL AS solved,
    greatest(revision_count, 0) AS revision_count FROM public.user_problems
  UNION ALL
  SELECT user_id, problem_id, event_type = 'solve', coalesce(revision_number, 0)
  FROM public.leaderboard_events
) history GROUP BY user_id, problem_id;

CREATE TABLE private.progress_requests (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  value JSONB NOT NULL,
  result JSONB NOT NULL,
  PRIMARY KEY (user_id, request_id)
);
CREATE TABLE private.progress_write_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_start TIMESTAMPTZ NOT NULL,
  minute_count INTEGER NOT NULL,
  day_start DATE NOT NULL,
  day_count INTEGER NOT NULL
);

CREATE FUNCTION private.lock_progress_user() RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  RETURN v_user;
END;
$$;

CREATE FUNCTION public.mutate_problem_progress(
  p_problem_id UUID, p_operation TEXT, p_value JSONB, p_request_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := private.lock_progress_user();
  v_request private.progress_requests;
  v_progress public.user_problems;
  v_award private.problem_award_state;
  v_difficulty TEXT;
  v_seconds INTEGER;
  v_revision INTEGER;
  v_points INTEGER;
  v_result JSONB;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_problem_id IS NULL OR p_request_id IS NULL OR p_operation IS NULL OR p_value IS NULL THEN
    RAISE EXCEPTION 'Invalid progress request';
  END IF;
  IF p_operation = 'status' THEN
    IF jsonb_typeof(p_value) <> 'string' OR p_value #>> '{}' NOT IN ('solved', 'unsolved') THEN
      RAISE EXCEPTION 'Invalid status';
    END IF;
  ELSIF p_operation = 'revise' THEN
    IF p_value <> '{}'::jsonb THEN RAISE EXCEPTION 'Revision numbers are server controlled'; END IF;
  ELSIF p_operation = 'favorite' THEN
    IF jsonb_typeof(p_value) <> 'boolean' THEN RAISE EXCEPTION 'Invalid favorite'; END IF;
  ELSIF p_operation = 'time' THEN
    IF jsonb_typeof(p_value) <> 'number' OR p_value::text !~ '^[0-9]+$'
      OR (p_value::text)::numeric NOT BETWEEN 1 AND 86400 THEN
      RAISE EXCEPTION 'Invalid duration';
    END IF;
    v_seconds := p_value::text::integer;
  ELSE RAISE EXCEPTION 'Invalid progress operation';
  END IF;

  SELECT * INTO v_request FROM private.progress_requests
    WHERE user_id = v_user AND request_id = p_request_id;
  IF FOUND THEN
    IF v_request.problem_id <> p_problem_id OR v_request.operation <> p_operation OR v_request.value <> p_value THEN
      RAISE EXCEPTION 'Request identifier already used';
    END IF;
    RETURN v_request.result;
  END IF;
  SELECT difficulty INTO STRICT v_difficulty FROM public.problems WHERE id = p_problem_id;

  INSERT INTO private.progress_write_limits AS limits VALUES
    (v_user, date_trunc('minute', v_now), 1, (v_now AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    minute_start = EXCLUDED.minute_start,
    minute_count = CASE WHEN limits.minute_start = EXCLUDED.minute_start THEN limits.minute_count + 1 ELSE 1 END,
    day_start = EXCLUDED.day_start,
    day_count = CASE WHEN limits.day_start = EXCLUDED.day_start THEN limits.day_count + 1 ELSE 1 END;
  IF EXISTS (SELECT 1 FROM private.progress_write_limits WHERE user_id = v_user
    AND (minute_count > 120 OR day_count > 2000)) THEN RAISE EXCEPTION 'Progress write limit reached'; END IF;

  INSERT INTO public.user_problems (user_id, problem_id) VALUES (v_user, p_problem_id) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT v_progress FROM public.user_problems WHERE user_id = v_user AND problem_id = p_problem_id FOR UPDATE;
  INSERT INTO private.problem_award_state (user_id, problem_id) VALUES (v_user, p_problem_id) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT v_award FROM private.problem_award_state WHERE user_id = v_user AND problem_id = p_problem_id;

  IF p_operation = 'status' THEN
    UPDATE public.user_problems SET status = p_value #>> '{}',
      solved_at = CASE WHEN p_value = '"solved"' AND status <> 'solved' THEN v_now ELSE solved_at END,
      ease_factor = CASE WHEN p_value = '"solved"' AND status <> 'solved' THEN 2.5 ELSE ease_factor END,
      interval_days = CASE WHEN p_value = '"solved"' AND status <> 'solved' THEN 1 ELSE interval_days END,
      repetitions = CASE WHEN p_value = '"solved"' AND status <> 'solved' THEN 0 ELSE repetitions END,
      next_review_at = CASE WHEN p_value = '"solved"' AND status <> 'solved' THEN v_now + interval '1 day' ELSE next_review_at END
    WHERE user_id = v_user AND problem_id = p_problem_id RETURNING * INTO v_progress;
    IF p_value = '"solved"' AND NOT v_award.solved THEN
      UPDATE private.problem_award_state SET solved = true WHERE user_id = v_user AND problem_id = p_problem_id;
      IF v_difficulty IN ('MEDIUM', 'HARD') THEN
        INSERT INTO public.leaderboard_events (user_id, problem_id, event_type, difficulty, points)
        VALUES (v_user, p_problem_id, 'solve', v_difficulty, CASE v_difficulty WHEN 'HARD' THEN 8 ELSE 4 END);
      END IF;
    END IF;
  ELSIF p_operation = 'revise' THEN
    IF v_progress.status <> 'solved' THEN RAISE EXCEPTION 'Only solved problems can be revised'; END IF;
    v_revision := greatest(v_progress.revision_count, v_award.revision_count) + 1;
    UPDATE public.user_problems SET revision_count = v_revision, last_revised_at = v_now
      WHERE user_id = v_user AND problem_id = p_problem_id RETURNING * INTO v_progress;
    UPDATE private.problem_award_state SET revision_count = v_revision WHERE user_id = v_user AND problem_id = p_problem_id;
    IF v_difficulty IN ('MEDIUM', 'HARD') THEN
      v_points := CASE WHEN v_revision = 1 THEN 2 ELSE 1 END * CASE WHEN v_difficulty = 'HARD' THEN 2 ELSE 1 END;
      INSERT INTO public.leaderboard_events (user_id, problem_id, event_type, difficulty, revision_number, points)
        VALUES (v_user, p_problem_id, 'revision', v_difficulty, v_revision, v_points);
    END IF;
  ELSIF p_operation = 'favorite' THEN
    UPDATE public.user_problems SET is_favorite = (p_value::text)::boolean
      WHERE user_id = v_user AND problem_id = p_problem_id RETURNING * INTO v_progress;
  ELSE
    UPDATE public.user_problems SET last_solve_seconds = v_seconds,
      best_solve_seconds = least(best_solve_seconds, v_seconds)
      WHERE user_id = v_user AND problem_id = p_problem_id RETURNING * INTO v_progress;
  END IF;
  v_result := jsonb_build_object('solvedAt', coalesce(v_progress.solved_at, v_now),
    'revisionCount', v_progress.revision_count, 'bestSeconds', v_progress.best_solve_seconds);
  INSERT INTO private.progress_requests VALUES (v_user, p_request_id, p_problem_id, p_operation, p_value, v_result);
  RETURN v_result;
END;
$$;

-- Interview progress must verify the owned question before producing any award.
CREATE FUNCTION public.set_interview_problem_completed(p_session_id UUID, p_problem_id UUID, p_completed BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.lock_progress_user(); v_status TEXT; v_ends_at TIMESTAMPTZ;
BEGIN
  IF p_completed IS NULL THEN RAISE EXCEPTION 'Invalid completion'; END IF;
  SELECT status,ends_at INTO v_status,v_ends_at FROM public.interview_sessions WHERE id = p_session_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_status <> 'active' OR v_ends_at <= clock_timestamp() THEN RAISE EXCEPTION 'Session has ended'; END IF;
  UPDATE public.interview_session_problems SET completed = p_completed WHERE session_id = p_session_id AND problem_id = p_problem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Problem not in session'; END IF;
  IF p_completed AND NOT EXISTS (SELECT 1 FROM public.user_problems WHERE user_id = v_user AND problem_id = p_problem_id AND status = 'solved') THEN
    PERFORM public.mutate_problem_progress(p_problem_id, 'status', '"solved"', gen_random_uuid());
  END IF;
END;
$$;
CREATE FUNCTION public.finish_interview_session(p_session_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.lock_progress_user(); v_status TEXT; v_problem UUID;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('completed', 'abandoned') THEN RAISE EXCEPTION 'Invalid session status'; END IF;
  SELECT status INTO v_status FROM public.interview_sessions WHERE id = p_session_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF v_status <> 'active' THEN
    IF v_status = p_status THEN RETURN; END IF;
    RAISE EXCEPTION 'Session has ended';
  END IF;
  FOR v_problem IN SELECT problem_id FROM public.interview_session_problems WHERE session_id = p_session_id AND completed ORDER BY position LOOP
    IF NOT EXISTS (SELECT 1 FROM public.user_problems WHERE user_id = v_user AND problem_id = v_problem AND status = 'solved') THEN
      PERFORM public.mutate_problem_progress(v_problem, 'status', '"solved"', gen_random_uuid());
    END IF;
  END LOOP;
  UPDATE public.interview_sessions SET status = p_status WHERE id = p_session_id;
END;
$$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_problems FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON public.interview_session_problems FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_leaderboard_solve(UUID), public.award_leaderboard_revision(UUID, INTEGER),
  public.increment_user_problem_revision(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mutate_problem_progress(UUID, TEXT, JSONB, UUID),
  public.set_interview_problem_completed(UUID, UUID, BOOLEAN), public.finish_interview_session(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_problem_progress(UUID, TEXT, JSONB, UUID),
  public.set_interview_problem_completed(UUID, UUID, BOOLEAN), public.finish_interview_session(UUID, TEXT) TO authenticated;
