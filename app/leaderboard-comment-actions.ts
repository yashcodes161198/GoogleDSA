"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data";
import { isLocalMode } from "@/lib/config";
import { getMemoryStore } from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";

export async function postLeaderboardComment(body: string, parentId: string | null): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to join the discussion." };
  if (typeof body !== "string" || body.trim().length < 1 || body.trim().length > 1000) {
    return { ok: false, error: "Write a comment between 1 and 1,000 characters." };
  }
  if (parentId !== null && (typeof parentId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(parentId))) {
    return { ok: false, error: "That reply target is invalid. Refresh and try again." };
  }

  try {
    if (isLocalMode()) {
      const comments = getMemoryStore().getLeaderboardComments();
      if (parentId && !comments.some((comment) => comment.id === parentId && comment.parent_id === null)) {
        return { ok: false, error: "That comment is no longer available." };
      }
      getMemoryStore().addLeaderboardComment(user.id, body.trim(), parentId);
    } else {
      const supabase = await createClient();
      const { error } = await supabase.from("leaderboard_comments").insert({
        user_id: user.id,
        body: body.trim(),
        parent_id: parentId,
      });
      if (error) throw error;
    }
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (error) {
    console.error("Failed to post leaderboard comment", error);
    return { ok: false, error: "Could not post your comment. Please try again." };
  }
}
