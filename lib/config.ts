import { localModeFromEnvironment } from "./local-mode";

export function isLocalMode(): boolean {
  if (typeof window !== "undefined") return false;
  return localModeFromEnvironment(process.env);
}

export const LOCAL_ADMIN = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@local.dev",
} as const;

export const DAILY_REVISION_LIMIT = 10;
