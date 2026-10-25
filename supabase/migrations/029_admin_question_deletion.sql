BEGIN;

GRANT DELETE ON public.problems TO authenticated;
DROP POLICY IF EXISTS "Admins can delete problems" ON public.problems;
CREATE POLICY "Admins can delete problems"
  ON public.problems FOR DELETE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Foreign keys cascade other references; revision lists store IDs inside JSON.
CREATE OR REPLACE FUNCTION private.remove_deleted_question_from_revision_sessions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE private.revision_sessions s
  SET entries = (
    SELECT coalesce(jsonb_agg(e.entry ORDER BY e.position), '[]'::jsonb)
    FROM jsonb_array_elements(s.entries) WITH ORDINALITY AS e(entry, position)
    WHERE e.entry->>'id' <> OLD.id::text
  ), version = s.version + 1
  WHERE s.entries @> jsonb_build_array(jsonb_build_object('id', OLD.id::text));
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.remove_deleted_question_from_revision_sessions() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS remove_deleted_question_from_revision_sessions ON public.problems;
CREATE TRIGGER remove_deleted_question_from_revision_sessions
  AFTER DELETE ON public.problems FOR EACH ROW
  EXECUTE FUNCTION private.remove_deleted_question_from_revision_sessions();

COMMIT;
