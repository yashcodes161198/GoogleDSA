-- Players can remove mistaken awards without changing problem progress.
GRANT DELETE ON TABLE public.leaderboard_events TO authenticated;

DROP POLICY IF EXISTS "Users can delete their own leaderboard events"
  ON public.leaderboard_events;
CREATE POLICY "Users can delete their own leaderboard events"
  ON public.leaderboard_events FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
