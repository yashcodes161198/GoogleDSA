import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supply the storage URL and server credential through the environment.");
const admin = createClient(url,key,{ auth:{ persistSession:false,autoRefreshToken:false } });
let removed = 0;
for (;;) {
  const { data, error } = await admin.rpc("expired_comment_media");
  if (error) throw new Error(error.message);
  if (!data?.length) break;
  const result = await admin.storage.from("leaderboard-comment-media").remove(data.map(row => row.path));
  if (result.error) throw new Error(result.error.message);
  removed += data.length;
}
const result = await admin.rpc("release_expired_comment_media");
if (result.error) throw new Error(result.error.message);
console.log(`Removed ${removed} abandoned/deleted-account attachments.`);
