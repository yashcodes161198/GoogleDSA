-- The timer ends the interview, but owners can still record or correct results.
CREATE OR REPLACE FUNCTION public.set_interview_problem_completed(p_session_id UUID, p_problem_id UUID, p_completed BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.lock_progress_user();
BEGIN
  IF p_completed IS NULL THEN RAISE EXCEPTION 'Invalid completion'; END IF;
  PERFORM 1 FROM public.interview_sessions WHERE id = p_session_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  UPDATE public.interview_session_problems SET completed = p_completed WHERE session_id = p_session_id AND problem_id = p_problem_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Problem not in session'; END IF;
  IF p_completed AND NOT EXISTS (SELECT 1 FROM public.user_problems WHERE user_id = v_user AND problem_id = p_problem_id AND status = 'solved') THEN
    PERFORM public.mutate_problem_progress(p_problem_id, 'status', '"solved"', gen_random_uuid());
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_interview_problem_completed(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_interview_problem_completed(UUID, UUID, BOOLEAN) TO authenticated;
