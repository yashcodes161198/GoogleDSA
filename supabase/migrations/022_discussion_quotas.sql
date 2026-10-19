-- Attachments remain public, but only the validating server may upload them.
DROP POLICY IF EXISTS "Users can upload their own leaderboard media" ON storage.objects;
DROP POLICY IF EXISTS "Users can remove their own leaderboard media" ON storage.objects;
UPDATE storage.buckets SET file_size_limit = 3145728 WHERE id = 'leaderboard-comment-media';

CREATE TABLE private.comment_media_reservations (
  path TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bytes INTEGER NOT NULL CHECK (bytes BETWEEN 1 AND 3145728),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finalized BOOLEAN NOT NULL DEFAULT false,
  comment_id UUID REFERENCES public.leaderboard_comments(id) ON DELETE CASCADE
);
CREATE INDEX comment_media_reservations_user ON private.comment_media_reservations(user_id);

CREATE FUNCTION public.reserve_comment_media(p_bytes INTEGER, p_extension TEXT) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.lock_progress_user(); v_path TEXT; v_count BIGINT; v_bytes BIGINT;
BEGIN
  IF p_bytes IS NULL OR p_bytes NOT BETWEEN 1 AND 3145728 OR p_extension IS NULL OR p_extension NOT IN ('gif','png','webp') THEN
    RAISE EXCEPTION 'Invalid attachment';
  END IF;
  SELECT count(*), coalesce(sum(bytes),0) INTO v_count, v_bytes FROM private.comment_media_reservations WHERE user_id = v_user;
  IF v_count >= 100 OR v_bytes + p_bytes > 52428800 THEN RAISE EXCEPTION 'Attachment quota reached'; END IF;
  IF (SELECT count(*) FROM private.comment_media_reservations WHERE user_id=v_user AND created_at > clock_timestamp()-interval '1 minute') >= 5 THEN
    RAISE EXCEPTION 'Attachment rate limit reached';
  END IF;
  v_path := v_user::text || '/' || gen_random_uuid()::text || '.' || p_extension;
  INSERT INTO private.comment_media_reservations(path,user_id,bytes) VALUES (v_path,v_user,p_bytes);
  RETURN v_path;
END;
$$;
CREATE FUNCTION public.finalize_comment_media(p_path TEXT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.comment_media_reservations SET finalized = true WHERE path=p_path
    AND created_at > clock_timestamp()-interval '15 minutes'
    AND EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='leaderboard-comment-media' AND name=p_path);
  IF NOT FOUND THEN RAISE EXCEPTION 'Attachment reservation expired'; END IF;
END;
$$;

CREATE FUNCTION public.enforce_comment_write_limits() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := private.lock_progress_user();
BEGIN
  IF NEW.user_id <> v_user THEN RAISE EXCEPTION 'Invalid comment author'; END IF;
  IF (SELECT count(*) FROM public.leaderboard_comments WHERE user_id=v_user AND created_at > clock_timestamp()-interval '1 minute') > 10
    OR (SELECT count(*) FROM public.leaderboard_comments WHERE user_id=v_user AND created_at > clock_timestamp()-interval '1 day') > 100 THEN
    RAISE EXCEPTION 'Comment posting limit reached';
  END IF;
  IF NEW.media_path IS NOT NULL THEN
    UPDATE private.comment_media_reservations SET comment_id=NEW.id
      WHERE path=NEW.media_path AND user_id=v_user AND finalized AND comment_id IS NULL
        AND created_at > clock_timestamp()-interval '15 minutes';
    IF NOT FOUND THEN RAISE EXCEPTION 'Attachment is not available'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- AFTER INSERT permits the reservation's comment FK to reference the new row.
CREATE TRIGGER enforce_comment_write_limits AFTER INSERT ON public.leaderboard_comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_write_limits();
CREATE INDEX leaderboard_comments_user_created ON public.leaderboard_comments(user_id,created_at);

CREATE FUNCTION public.expired_comment_media() RETURNS TABLE(path TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT o.name FROM storage.objects o
  LEFT JOIN private.comment_media_reservations r ON r.path=o.name
  WHERE o.bucket_id='leaderboard-comment-media'
    AND o.created_at < clock_timestamp()-interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM public.leaderboard_comments c JOIN auth.users u ON u.id=c.user_id WHERE c.media_path=o.name)
  ORDER BY o.name LIMIT 100;
$$;
CREATE FUNCTION public.release_expired_comment_media() RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM private.comment_media_reservations r WHERE r.comment_id IS NULL
    AND r.created_at < clock_timestamp()-interval '1 hour'
    AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='leaderboard-comment-media' AND o.name=r.path);
$$;
REVOKE ALL ON private.comment_media_reservations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_comment_media(INTEGER,TEXT), public.finalize_comment_media(TEXT),
  public.enforce_comment_write_limits(), public.expired_comment_media(), public.release_expired_comment_media() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_comment_media(INTEGER,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_comment_media(TEXT), public.expired_comment_media(), public.release_expired_comment_media() TO service_role;
