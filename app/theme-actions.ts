"use server";

import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { isLocalMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { parseThemeSettings } from "@/lib/themes/catalog";
import { localThemeCookie } from "@/lib/themes/server";

export async function saveThemeSettings(value: unknown): Promise<{ error: string | null }> {
  const settings = parseThemeSettings(value);
  if (!settings) return { error: "Choose a valid light and dark theme." };
  const user = await requireUser();
  if (isLocalMode()) {
    (await cookies()).set(localThemeCookie(user.id), JSON.stringify(settings), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
    return { error: null };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { appearance: settings } });
  if (error) {
    console.error("Failed to save appearance", error);
    return { error: "Your theme could not be saved. Try again." };
  }
  return { error: null };
}
