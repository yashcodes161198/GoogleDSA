-- Comment authors may change the text of their own comments and replies.
GRANT UPDATE (body) ON public.leaderboard_comments TO authenticated;

CREATE POLICY "Authors can edit their leaderboard comments"
  ON public.leaderboard_comments FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
