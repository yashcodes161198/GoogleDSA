"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data";
import { isLocalMode } from "@/lib/config";
import { getMemoryStore } from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";
import { MAX_MEDIA_BYTES } from "@/lib/leaderboard/media-limits";
import { validateMedia } from "@/lib/leaderboard/validate-media";
import { createStorageAdmin } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export async function postLeaderboardComment(formData: FormData, parentId: string | null): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to join the discussion." };
  const rawBody = formData.get("body");
  const rawMedia = formData.get("media");
  if (typeof rawBody !== "string" || rawBody.trim().length > 1000) {
    return { ok: false, error: "Keep your comment under 1,000 characters." };
  }
  const body = rawBody.trim();
  const file = rawMedia instanceof File && rawMedia.size > 0 ? rawMedia : null;
  if (!body && !file) {
    return { ok: false, error: "Write a comment or attach a GIF or sticker." };
  }
  if (file && file.size > MAX_MEDIA_BYTES) {
    return { ok: false, error: "GIFs and stickers must be 3 MB or smaller." };
  }
  if (parentId !== null && (typeof parentId !== "string" || !UUID_PATTERN.test(parentId))) {
    return { ok: false, error: "That reply target is invalid. Refresh and try again." };
  }

  let uploadedPath: string | null = null;
  try {
    const media = file ? await validateMedia(Buffer.from(await file.arrayBuffer())) : null;
    if (isLocalMode()) {
      const comments = getMemoryStore().getLeaderboardComments();
      if (parentId && !comments.some((comment) => comment.id === parentId && comment.parent_id === null)) {
        return { ok: false, error: "That comment is no longer available." };
      }
      getMemoryStore().addLeaderboardComment(user.id, body, parentId, {
        media_kind: media?.kind ?? null,
        media_url: media ? `data:${media.contentType};base64,${media.data.toString("base64")}` : null,
      });
    } else {
      const supabase = await createClient();
      if (media) {
        const admin = createStorageAdmin();
        const reservation = await supabase.rpc("reserve_comment_media", { p_bytes: media.data.length, p_extension: media.extension });
        if (reservation.error) throw reservation.error;
        uploadedPath = reservation.data as string;
        const { error: uploadError } = await admin.storage.from("leaderboard-comment-media")
          .upload(uploadedPath, media.data, { contentType: media.contentType, upsert: false });
        if (uploadError) throw uploadError;
        const finalized = await admin.rpc("finalize_comment_media", { p_path: uploadedPath });
        if (finalized.error) throw finalized.error;
      }
      const { error } = await supabase.from("leaderboard_comments").insert({
        user_id: user.id,
        body,
        parent_id: parentId,
        ...(media ? { media_path: uploadedPath, media_kind: media.kind } : {}),
      });
      if (error) throw error;
    }
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (error) {
    if (uploadedPath) {
      try {
        const cleanup = await createStorageAdmin().storage.from("leaderboard-comment-media").remove([uploadedPath]);
        if (cleanup.error) console.error("Attachment cleanup needs a retry", cleanup.error.message);
      } catch {
        console.error("Attachment cleanup needs a retry");
      }
    }
    console.error("Failed to post leaderboard comment", error);
    return { ok: false, error: error instanceof Error ? error.message : "Could not post your comment. Please try again." };
  }
}

export async function editLeaderboardComment(commentId: string, rawBody: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to edit your comment." };
  if (!UUID_PATTERN.test(commentId)) {
    return { ok: false, error: "That comment is no longer available." };
  }
  if (typeof rawBody !== "string" || rawBody.trim().length > 1000) {
    return { ok: false, error: "Keep your comment under 1,000 characters." };
  }
  const body = rawBody.trim();

  try {
    if (isLocalMode()) {
      const updated = getMemoryStore().updateLeaderboardComment(user.id, commentId, body);
      if (!updated) return { ok: false, error: "That comment cannot be edited." };
    } else {
      const supabase = await createClient();
      const { data: comment, error: lookupError } = await supabase
        .from("leaderboard_comments")
        .select("media_path")
        .eq("id", commentId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (!comment) return { ok: false, error: "That comment is no longer available." };
      if (!body && !comment.media_path) {
        return { ok: false, error: "Write a comment or keep its GIF or sticker." };
      }
      const { data: updated, error } = await supabase
        .from("leaderboard_comments")
        .update({ body })
        .eq("id", commentId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return { ok: false, error: "That comment is no longer available." };
    }
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (error) {
    console.error("Failed to edit leaderboard comment", error);
    return { ok: false, error: "Could not save your comment. Please try again." };
  }
}
