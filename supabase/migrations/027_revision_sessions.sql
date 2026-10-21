-- The list belongs to the account; progress counts determine completion without a daily reset.
CREATE TABLE IF NOT EXISTS private.revision_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  entries JSONB NOT NULL CHECK (jsonb_typeof(entries) = 'array' AND jsonb_array_length(entries) <= 10)
);
REVOKE ALL ON private.revision_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_revision_session(p_expected_version INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user UUID := private.lock_progress_user();
  v_session private.revision_sessions;
  v_current JSONB := '[]';
  v_kept JSONB := '[]';
  v_entries JSONB;
BEGIN
  IF p_expected_version IS NOT NULL AND p_expected_version < 1 THEN
    RAISE EXCEPTION 'Invalid revision session version';
  END IF;
  SELECT * INTO v_session FROM private.revision_sessions WHERE user_id = v_user;
  IF FOUND THEN
    -- Reads and stale/retried replacements return the existing list unchanged.
    IF p_expected_version IS NULL OR p_expected_version <> v_session.version THEN
      RETURN jsonb_build_object('version', v_session.version, 'entries', v_session.entries);
    END IF;
    v_current := v_session.entries;
    SELECT coalesce(jsonb_agg(e.entry ORDER BY e.position), '[]') INTO v_kept
      FROM jsonb_array_elements(v_current) WITH ORDINALITY AS e(entry, position)
      JOIN public.problems p ON p.id = (e.entry->>'id')::uuid
      LEFT JOIN public.user_problems up ON up.problem_id = p.id AND up.user_id = v_user
      WHERE coalesce(up.revision_count, 0) <= (e.entry->>'revisionCount')::integer;
  END IF;

  WITH candidates AS (
    SELECT p.id, up.revision_count, up.solved_at, up.last_revised_at
    FROM public.user_problems up JOIN public.problems p ON p.id = up.problem_id
    WHERE up.user_id = v_user AND up.status = 'solved'
      AND (up.solved_at IS NULL OR up.solved_at <= now() - interval '48 hours')
      AND (up.last_revised_at IS NULL OR up.last_revised_at <= now() - interval '48 hours')
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_current) e WHERE e->>'id' = p.id::text)
    ORDER BY (coalesce(up.revision_count, 0) = 0) DESC,
      CASE WHEN coalesce(up.revision_count, 0) = 0 THEN up.solved_at ELSE up.last_revised_at END ASC NULLS LAST,
      up.solved_at ASC NULLS LAST, p.id
    LIMIT greatest(0, 10 - jsonb_array_length(v_kept))
  ), entries AS (
    SELECT e AS entry FROM jsonb_array_elements(v_kept) e
    UNION ALL
    SELECT jsonb_build_object('id', id, 'revisionCount', coalesce(revision_count, 0)) FROM candidates
  )
  SELECT coalesce(jsonb_agg(e.entry ORDER BY (coalesce(up.revision_count, 0) = 0) DESC,
    CASE WHEN coalesce(up.revision_count, 0) = 0 THEN up.solved_at ELSE up.last_revised_at END ASC NULLS LAST,
    up.solved_at ASC NULLS LAST, up.problem_id), '[]') INTO v_entries
  FROM entries e LEFT JOIN public.user_problems up ON up.user_id = v_user AND up.problem_id = (e.entry->>'id')::uuid;

  INSERT INTO private.revision_sessions (user_id, version, entries)
    VALUES (v_user, coalesce(v_session.version, 0) + 1, v_entries)
    ON CONFLICT (user_id) DO UPDATE SET version = EXCLUDED.version, entries = EXCLUDED.entries
    RETURNING * INTO v_session;
  RETURN jsonb_build_object('version', v_session.version, 'entries', v_session.entries);
END;
$$;
REVOKE ALL ON FUNCTION public.get_revision_session(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_revision_session(INTEGER) TO authenticated;
