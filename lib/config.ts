export function isLocalMode(): boolean {
  return (
    process.env.USE_LOCAL_DB === "true" ||
    process.env.NEXT_PUBLIC_USE_LOCAL_DB === "true"
  );
}

export const LOCAL_ADMIN = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@local.dev",
} as const;

export const DAILY_REVISION_LIMIT = 10;
