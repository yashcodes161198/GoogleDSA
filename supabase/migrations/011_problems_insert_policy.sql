-- Allow authenticated users to add shared catalog questions from the app.
CREATE POLICY "Authenticated users can insert problems"
  ON problems FOR INSERT
  TO authenticated
  WITH CHECK (true);
