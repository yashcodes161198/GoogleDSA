"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data";
import { isLocalMode } from "@/lib/config";
import { getMemoryStore } from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

function identifyMedia(bytes: Buffer): {
  kind: "gif" | "sticker";
  contentType: string;
  extension: string;
} | null {
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) {
    return { kind: "gif", contentType: "image/gif", extension: "gif" };
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { kind: "sticker", contentType: "image/png", extension: "png" };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { kind: "sticker", contentType: "image/webp", extension: "webp" };
  }
  return null;
}

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
    return { ok: false, error: "GIFs and stickers must be 5 MB or smaller." };
  }
  if (parentId !== null && (typeof parentId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(parentId))) {
    return { ok: false, error: "That reply target is invalid. Refresh and try again." };
  }

  const bytes = file ? Buffer.from(await file.arrayBuffer()) : null;
  const media = bytes ? identifyMedia(bytes) : null;
  if (file && !media) {
    return { ok: false, error: "Choose a GIF, PNG, or WebP image." };
  }

  let uploadedPath: string | null = null;
  try {
    if (isLocalMode()) {
      const comments = getMemoryStore().getLeaderboardComments();
      if (parentId && !comments.some((comment) => comment.id === parentId && comment.parent_id === null)) {
        return { ok: false, error: "That comment is no longer available." };
      }
      getMemoryStore().addLeaderboardComment(user.id, body, parentId, {
        media_kind: media?.kind ?? null,
        media_url: media && bytes ? `data:${media.contentType};base64,${bytes.toString("base64")}` : null,
      });
    } else {
      const supabase = await createClient();
      if (media && bytes) {
        uploadedPath = `${user.id}/${randomUUID()}.${media.extension}`;
        const { error: uploadError } = await supabase.storage
          .from("leaderboard-comment-media")
          .upload(uploadedPath, bytes, { contentType: media.contentType, upsert: false });
        if (uploadError) throw uploadError;
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
      const supabase = await createClient();
      await supabase.storage.from("leaderboard-comment-media").remove([uploadedPath]);
    }
    console.error("Failed to post leaderboard comment", error);
    return { ok: false, error: "Could not post your comment. Please try again." };
  }
}
