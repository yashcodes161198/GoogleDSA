-- Repair missing/partially applied 018 and 019 before running 020-023.
-- Keep existing comments and avoid restoring direct client upload permissions.
ALTER TABLE public.leaderboard_comments
  ADD COLUMN IF NOT EXISTS media_path TEXT,
  ADD COLUMN IF NOT EXISTS media_kind TEXT;

ALTER TABLE public.leaderboard_comments DROP CONSTRAINT IF EXISTS leaderboard_comments_body_check;
DO $repair$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.leaderboard_comments'::regclass
    AND conname='leaderboard_comments_media_kind_check') THEN
    ALTER TABLE public.leaderboard_comments ADD CONSTRAINT leaderboard_comments_media_kind_check
      CHECK (media_kind IN ('gif','sticker'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.leaderboard_comments'::regclass
    AND conname='leaderboard_comments_content_check') THEN
    ALTER TABLE public.leaderboard_comments ADD CONSTRAINT leaderboard_comments_content_check CHECK (
      char_length(btrim(body)) <= 1000
      AND (char_length(btrim(body)) > 0 OR media_path IS NOT NULL)
      AND ((media_path IS NULL AND media_kind IS NULL) OR (media_path IS NOT NULL AND media_kind IS NOT NULL))
    );
  END IF;
END;
$repair$;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('leaderboard-comment-media','leaderboard-comment-media',true,3145728,ARRAY['image/gif','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can post leaderboard comments" ON public.leaderboard_comments;
CREATE POLICY "Authenticated users can post leaderboard comments" ON public.leaderboard_comments
  FOR INSERT TO authenticated WITH CHECK (
    user_id=(SELECT auth.uid())
    AND (media_path IS NULL OR media_path ~ ('^'||(SELECT auth.uid())::text||'/[0-9a-f-]{36}[.](gif|png|webp)$'))
  );

-- The old six-column function cannot be replaced with an eight-column return type in place.
DROP FUNCTION IF EXISTS public.get_leaderboard_comments();
CREATE FUNCTION public.get_leaderboard_comments()
RETURNS TABLE (id UUID,user_id UUID,display_name TEXT,body TEXT,parent_id UUID,created_at TIMESTAMPTZ,media_path TEXT,media_kind TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id,c.user_id,
    COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''),NULLIF(u.raw_user_meta_data->>'name',''),
      NULLIF(split_part(u.email,'@',1),''),'Player'),
    c.body,c.parent_id,c.created_at,c.media_path,c.media_kind
  FROM public.leaderboard_comments c JOIN auth.users u ON u.id=c.user_id
  ORDER BY c.created_at,c.id;
$$;
REVOKE ALL ON FUNCTION public.get_leaderboard_comments() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_comments() TO authenticated;

GRANT UPDATE(body) ON public.leaderboard_comments TO authenticated;
DROP POLICY IF EXISTS "Authors can edit their leaderboard comments" ON public.leaderboard_comments;
CREATE POLICY "Authors can edit their leaderboard comments" ON public.leaderboard_comments
  FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
