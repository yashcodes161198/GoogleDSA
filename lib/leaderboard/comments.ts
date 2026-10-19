export type LeaderboardComment = {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  media_kind: "gif" | "sticker" | null;
  media_url: string | null;
  parent_id: string | null;
  created_at: string;
  reply_count?: number;
};
