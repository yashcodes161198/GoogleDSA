-- Only Supabase users with app_metadata.role = admin may insert catalog questions.
DROP POLICY IF EXISTS "Authenticated users can insert problems" ON problems;

CREATE POLICY "Admins can insert problems"
  ON problems FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
