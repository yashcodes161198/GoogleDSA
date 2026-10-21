"use server";

import { getUser } from "@/lib/auth";
import { isLocalMode } from "@/lib/config";
import { getMemoryStore } from "@/lib/memory/store";
import type { RevisionSession } from "@/lib/revision/session";
import { createClient } from "@/lib/supabase/server";

async function revisionSession(expectedVersion: number | null) {
  try {
    if (expectedVersion !== null && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) {
      throw new Error("Invalid revision session version");
    }
    const user = await getUser();
    if (!user) return { ok: false as const, error: "Sign in to resume your revision list." };
    if (isLocalMode()) {
      return { ok: true as const, session: getMemoryStore().getRevisionSession(user.id, expectedVersion) };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_revision_session", { p_expected_version: expectedVersion });
    if (error) throw error;
    return { ok: true as const, session: data as RevisionSession };
  } catch (error) {
    console.error("Failed to access revision session", error);
    return { ok: false as const, error: "Could not load or update your saved revision list. Please try again." };
  }
}

export async function loadRevisionSession() {
  return revisionSession(null);
}

export async function replaceRevisionSession(version: number) {
  return revisionSession(version);
}
