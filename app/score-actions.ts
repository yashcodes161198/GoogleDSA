"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/data";
import { isLocalMode } from "@/lib/config";
import { getMemoryStore } from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";

export async function deleteScoreActivity(eventId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Sign in to delete a point award." };
    if (typeof eventId !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(eventId)) {
      return { ok: false, error: "This point award is invalid. Refresh and try again." };
    }

    if (isLocalMode()) {
      getMemoryStore().deleteScoreActivity(user.id, eventId);
    } else {
      const supabase = await createClient();
      const { error } = await supabase.from("leaderboard_events")
        .delete().eq("id", eventId).eq("user_id", user.id);
      if (error) throw error;
    }

    revalidatePath("/settings");
    revalidatePath("/leaderboard");
    return { ok: true };
  } catch (error) {
    console.error("Failed to delete score activity", error);
    return { ok: false, error: "Could not delete this point award. Please try again." };
  }
}
