-- Only completed weeks, using the same Monday 00:00 IST boundary as the live board.
CREATE OR REPLACE FUNCTION public.get_previous_weekly_winners()
RETURNS TABLE (week_start TIMESTAMPTZ, user_id UUID, display_name TEXT, points BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH bounds AS (
    SELECT timezone('Asia/Kolkata', date_trunc('week', timezone('Asia/Kolkata', now()))) AS start
  ), totals AS (
    SELECT timezone('Asia/Kolkata', date_trunc('week', timezone('Asia/Kolkata', e.created_at))) AS week_start,
      e.user_id, sum(e.points) AS points
    FROM leaderboard_events e CROSS JOIN bounds b
    WHERE e.created_at >= b.start - interval '21 days' AND e.created_at < b.start
    GROUP BY 1, 2
  ), ranked AS (
    SELECT t.*, rank() OVER (PARTITION BY t.week_start ORDER BY t.points DESC) AS place
    FROM totals t
  )
  SELECT r.week_start, r.user_id,
    left(COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), NULLIF(u.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(u.email, '@', 1), ''), 'Player'), 100), r.points
  FROM ranked r JOIN auth.users u ON u.id = r.user_id
  WHERE r.place = 1
  ORDER BY r.week_start DESC, r.user_id;
$$;
REVOKE ALL ON FUNCTION public.get_previous_weekly_winners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_previous_weekly_winners() TO authenticated;
