-- Repair legacy invalid rows before validating the finite timestamp invariant.
UPDATE public.leaderboard_comments SET created_at = now() WHERE NOT isfinite(created_at);
ALTER TABLE public.leaderboard_comments ADD CONSTRAINT leaderboard_comments_finite_time CHECK (isfinite(created_at));

CREATE FUNCTION public.assign_leaderboard_comment_timestamp() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER assign_leaderboard_comment_timestamp BEFORE INSERT ON public.leaderboard_comments
  FOR EACH ROW EXECUTE FUNCTION public.assign_leaderboard_comment_timestamp();
REVOKE ALL ON FUNCTION public.assign_leaderboard_comment_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON public.leaderboard_comments FROM authenticated;
GRANT INSERT (user_id, body, parent_id, media_path, media_kind) ON public.leaderboard_comments TO authenticated;
