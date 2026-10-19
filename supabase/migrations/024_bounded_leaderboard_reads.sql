-- Hard page limits also apply to callers bypassing the application.
-- The isolated 10k-event plan sorted a full scan for each page without this index.
CREATE INDEX IF NOT EXISTS leaderboard_events_user_created_id_idx
  ON public.leaderboard_events(user_id,created_at DESC,id DESC);

CREATE OR REPLACE FUNCTION public.get_leaderboard_comments_page(
  p_parent UUID DEFAULT NULL, p_before TIMESTAMPTZ DEFAULT NULL, p_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID, user_id UUID, display_name TEXT, body TEXT, parent_id UUID,
  created_at TIMESTAMPTZ, media_path TEXT, media_kind TEXT, reply_count BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.user_id,
    left(COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), NULLIF(u.raw_user_meta_data->>'name',''),
      NULLIF(split_part(u.email,'@',1),''), 'Player'), 100),
    c.body, c.parent_id, c.created_at, c.media_path, c.media_kind,
    CASE WHEN p_parent IS NULL THEN (SELECT count(*) FROM leaderboard_comments r WHERE r.parent_id=c.id) ELSE 0 END
  FROM leaderboard_comments c JOIN auth.users u ON u.id=c.user_id
  WHERE c.parent_id IS NOT DISTINCT FROM p_parent
    AND (p_before IS NULL OR (c.created_at,c.id) < (p_before,p_id))
  ORDER BY c.created_at DESC,c.id DESC LIMIT 21;
$$;
REVOKE ALL ON FUNCTION public.get_leaderboard_comments_page(UUID,TIMESTAMPTZ,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_comments_page(UUID,TIMESTAMPTZ,UUID) TO authenticated;

-- Keep the legacy signature bounded for older callers as well.
CREATE OR REPLACE FUNCTION public.get_leaderboard_comments()
RETURNS TABLE (id UUID,user_id UUID,display_name TEXT,body TEXT,parent_id UUID,created_at TIMESTAMPTZ,media_path TEXT,media_kind TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id,user_id,display_name,body,parent_id,created_at,media_path,media_kind
  FROM get_leaderboard_comments_page() LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.get_score_activity_page(
  p_user UUID, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ,
  p_before TIMESTAMPTZ DEFAULT NULL, p_id UUID DEFAULT NULL,
  p_action TEXT DEFAULT 'all', p_day DATE DEFAULT NULL, p_summary BOOLEAN DEFAULT TRUE
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_events JSONB; v_summary JSONB := '[]';
BEGIN
  IF p_user IS NULL OR p_start IS NULL OR p_end IS NULL OR NOT isfinite(p_start) OR NOT isfinite(p_end)
    OR p_end <= p_start OR p_end-p_start > interval '31 days'
    OR p_action IS NULL OR p_action NOT IN ('all','solved','first-revision','later-revision') THEN
    RAISE EXCEPTION 'Invalid activity range or filter';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC,e.id DESC),'[]') INTO v_events
  FROM (
    SELECT e.id,e.problem_id,p.title AS problem_title,e.difficulty,e.event_type,e.revision_number,e.points,e.created_at
    FROM leaderboard_events e JOIN problems p ON p.id=e.problem_id
    WHERE e.user_id=p_user AND e.created_at>=p_start AND e.created_at<p_end
      AND (p_before IS NULL OR (e.created_at,e.id)<(p_before,p_id))
      AND (p_day IS NULL OR (e.created_at AT TIME ZONE 'Asia/Kolkata')::date=p_day)
      AND (p_action='all' OR CASE WHEN e.event_type='solve' THEN 'solved'
        WHEN e.revision_number=1 THEN 'first-revision' ELSE 'later-revision' END=p_action)
    ORDER BY e.created_at DESC,e.id DESC LIMIT 51
  ) e;
  IF p_summary THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]') INTO v_summary FROM (
      SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
        CASE WHEN event_type='solve' THEN 'solved' WHEN revision_number=1 THEN 'first-revision' ELSE 'later-revision' END AS action,
        sum(points)::bigint AS points,count(*) AS count
      FROM leaderboard_events WHERE user_id=p_user AND created_at>=p_start AND created_at<p_end GROUP BY 1,2
    ) s;
  END IF;
  RETURN jsonb_build_object('events',v_events,'summary',v_summary);
END;
$$;
REVOKE ALL ON FUNCTION public.get_score_activity_page(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ,UUID,TEXT,DATE,BOOLEAN) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_score_activity_page(UUID,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ,UUID,TEXT,DATE,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard()
RETURNS TABLE (user_id UUID,display_name TEXT,points INTEGER,rank INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH bounds AS (
    SELECT timezone('Asia/Kolkata',date_trunc('week',timezone('Asia/Kolkata',now()))) AS start
  ), totals AS (
    SELECT e.user_id,sum(e.points)::int AS points FROM leaderboard_events e CROSS JOIN bounds b
    WHERE e.created_at>=b.start AND e.created_at<b.start+interval '7 days' GROUP BY e.user_id
  ), ranked AS (
    SELECT t.user_id,left(COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''),NULLIF(u.raw_user_meta_data->>'name',''),
      NULLIF(split_part(u.email,'@',1),''),'Player'),100) AS display_name,t.points,
      rank() OVER (ORDER BY t.points DESC)::int AS rank,
      row_number() OVER (ORDER BY t.points DESC,t.user_id) AS position
    FROM totals t JOIN auth.users u ON u.id=t.user_id
  ) SELECT user_id,display_name,points,rank FROM ranked
    WHERE position<=100 OR user_id=auth.uid() ORDER BY points DESC,user_id;
$$;
