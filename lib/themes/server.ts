import { cache } from "react";
import { cookies } from "next/headers";
import { getUser } from "@/lib/auth";
import { isLocalMode } from "@/lib/config";
import { DEFAULT_THEME_SETTINGS, parseThemeSettings } from "./catalog";

export function localThemeCookie(userId: string) {
  return `google-dsa-appearance-${userId}`;
}

export const getThemeSettings = cache(async () => {
  const user = await getUser();
  if (!user) return DEFAULT_THEME_SETTINGS;
  if (isLocalMode()) {
    const value = (await cookies()).get(localThemeCookie(user.id))?.value;
    try {
      return parseThemeSettings(JSON.parse(value ?? "null")) ?? DEFAULT_THEME_SETTINGS;
    } catch {
      return DEFAULT_THEME_SETTINGS;
    }
  }
  return parseThemeSettings("user_metadata" in user ? user.user_metadata?.appearance : null)
    ?? DEFAULT_THEME_SETTINGS;
});
