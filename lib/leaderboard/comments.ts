export type LeaderboardComment = {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};
