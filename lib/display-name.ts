export function getDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null): string {
  for (const value of [user?.user_metadata?.full_name, user?.user_metadata?.name]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user?.email?.split("@")[0] || "Player";
}

export function parseDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name && name.length <= 40 ? name : null;
}
