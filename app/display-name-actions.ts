"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isLocalMode } from "@/lib/config";
import { parseDisplayName } from "@/lib/display-name";
import { getMemoryStore } from "@/lib/memory/store";
import { createClient } from "@/lib/supabase/server";

export async function saveDisplayName(
  _previous: { error: string | null; saved: boolean },
  formData: FormData,
): Promise<{ error: string | null; saved: boolean }> {
  await requireUser();
  const name = parseDisplayName(formData.get("displayName"));
  if (!name) return { error: "Enter a name of 1 to 40 characters.", saved: false };

  if (isLocalMode()) {
    getMemoryStore().displayName = name;
  } else {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } });
    if (error) {
      console.error("Failed to save display name", error);
      return { error: "Your name could not be saved. Try again.", saved: false };
    }
  }

  revalidatePath("/", "layout");
  return { error: null, saved: true };
}
