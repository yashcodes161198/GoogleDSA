-- Normalize legacy ordering before enforcing one position per session.
ALTER TABLE public.interview_session_problems DROP CONSTRAINT interview_session_problems_position_check;
WITH ordered AS (
  SELECT session_id,problem_id,row_number() OVER (PARTITION BY session_id ORDER BY position,problem_id) AS position
  FROM public.interview_session_problems
)
UPDATE public.interview_session_problems p SET position=o.position FROM ordered o
  WHERE p.session_id=o.session_id AND p.problem_id=o.problem_id;
ALTER TABLE public.interview_session_problems ADD CONSTRAINT interview_session_problems_position_check CHECK(position>0);
ALTER TABLE public.interview_session_problems ADD CONSTRAINT interview_session_problems_unique_position UNIQUE(session_id,position);
UPDATE public.interview_sessions SET status='completed' WHERE status='active' AND ends_at<=now();
WITH ranked AS (
  SELECT id,row_number() OVER (PARTITION BY user_id ORDER BY started_at DESC,id DESC) AS position
  FROM public.interview_sessions WHERE status='active'
)
UPDATE public.interview_sessions s SET status='completed' FROM ranked r WHERE s.id=r.id AND r.position>1;
CREATE UNIQUE INDEX interview_one_active_per_user ON public.interview_sessions(user_id) WHERE status='active';
CREATE TABLE private.interview_start_requests (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  input JSONB NOT NULL,
  session_id UUID NOT NULL REFERENCES public.interview_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id)
);

CREATE FUNCTION public.start_interview_session(p_problem_ids UUID[],p_duration_minutes INTEGER,p_force_new BOOLEAN,p_mode TEXT,p_request_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.lock_progress_user(); v_session UUID; v_previous private.interview_start_requests;
  v_input JSONB := jsonb_build_array(p_problem_ids,p_duration_minutes,p_force_new,p_mode);
BEGIN
  IF p_request_id IS NULL OR p_problem_ids IS NULL OR array_ndims(p_problem_ids)<>1 OR cardinality(p_problem_ids)<1
    OR cardinality(p_problem_ids)>(SELECT count(*) FROM public.problems)
    OR p_duration_minutes IS NULL OR p_duration_minutes NOT BETWEEN 15 AND 480
    OR p_force_new IS NULL OR p_mode IS NULL OR p_mode NOT IN ('random','picked') THEN RAISE EXCEPTION 'Invalid interview configuration'; END IF;
  IF p_mode='random' AND cardinality(p_problem_ids)>20 THEN RAISE EXCEPTION 'Random interviews allow at most 20 questions'; END IF;
  IF (SELECT count(DISTINCT id) FROM unnest(p_problem_ids) id)<>cardinality(p_problem_ids)
    OR EXISTS (SELECT 1 FROM unnest(p_problem_ids) ids(id) LEFT JOIN public.problems p ON p.id=ids.id WHERE p.id IS NULL) THEN
    RAISE EXCEPTION 'Choose distinct available problems';
  END IF;
  SELECT * INTO v_previous FROM private.interview_start_requests WHERE user_id=v_user AND request_id=p_request_id;
  IF FOUND THEN
    IF v_previous.input<>v_input THEN RAISE EXCEPTION 'Request identifier already used'; END IF;
    RETURN v_previous.session_id;
  END IF;
  IF (SELECT count(*) FROM private.interview_start_requests WHERE user_id=v_user AND created_at>clock_timestamp()-interval '1 minute')>=10 THEN
    RAISE EXCEPTION 'Interview start limit reached'; END IF;
  UPDATE public.interview_sessions SET status='completed' WHERE user_id=v_user AND status='active' AND ends_at<=now();
  SELECT id INTO v_session FROM public.interview_sessions WHERE user_id=v_user AND status='active' FOR UPDATE;
  IF FOUND AND NOT p_force_new THEN RETURN v_session; END IF;
  UPDATE public.interview_sessions SET status='completed' WHERE user_id=v_user AND status='active';
  INSERT INTO public.interview_sessions(user_id,started_at,ends_at) VALUES
    (v_user,clock_timestamp(),clock_timestamp()+p_duration_minutes*interval '1 minute') RETURNING id INTO v_session;
  INSERT INTO public.interview_session_problems(session_id,problem_id,position)
    SELECT v_session,id,ordinality FROM unnest(p_problem_ids) WITH ORDINALITY ids(id,ordinality);
  INSERT INTO private.interview_start_requests(user_id,request_id,input,session_id) VALUES (v_user,p_request_id,v_input,v_session);
  RETURN v_session;
END;
$$;
REVOKE ALL ON private.interview_start_requests FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.interview_sessions,public.interview_session_problems FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.start_interview_session(UUID[],INTEGER,BOOLEAN,TEXT,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_interview_session(UUID[],INTEGER,BOOLEAN,TEXT,UUID) TO authenticated;
