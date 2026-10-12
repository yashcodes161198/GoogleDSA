-- A persistent conversation shared by everyone who can view the leaderboard.
CREATE TABLE IF NOT EXISTS public.leaderboard_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.leaderboard_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_comments_not_self_reply CHECK (id IS DISTINCT FROM parent_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_comments_created_at_idx
  ON public.leaderboard_comments (created_at, id);
CREATE INDEX IF NOT EXISTS leaderboard_comments_parent_id_idx
  ON public.leaderboard_comments (parent_id);

ALTER TABLE public.leaderboard_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read leaderboard comments"
  ON public.leaderboard_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can post leaderboard comments"
  ON public.leaderboard_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.validate_leaderboard_comment_reply()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent_id INTO v_parent_id
    FROM public.leaderboard_comments
    WHERE id = NEW.parent_id;
    IF NOT FOUND OR v_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Replies must target a top-level comment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_leaderboard_comment_reply
  BEFORE INSERT ON public.leaderboard_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_leaderboard_comment_reply();

REVOKE ALL ON public.leaderboard_comments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.leaderboard_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.get_leaderboard_comments()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  display_name TEXT,
  body TEXT,
  parent_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.user_id,
    COALESCE(
      NULLIF(u.raw_user_meta_data->>'full_name', ''),
      NULLIF(u.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(u.email, '@', 1), ''),
      'Player'
    ) AS display_name,
    c.body,
    c.parent_id,
    c.created_at
  FROM public.leaderboard_comments c
  JOIN auth.users u ON u.id = c.user_id
  ORDER BY c.created_at, c.id;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard_comments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_comments() TO authenticated;
REVOKE ALL ON FUNCTION public.validate_leaderboard_comment_reply() FROM PUBLIC, anon, authenticated;
