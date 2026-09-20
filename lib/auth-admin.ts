import { isLocalMode, LOCAL_ADMIN } from "@/lib/config";

export type AdminCheckUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};

export function isAdminUser(user: AdminCheckUser | null | undefined): boolean {
  if (!user) return false;
  if (isLocalMode()) {
    return user.id === LOCAL_ADMIN.id;
  }
  return user.app_metadata?.role === "admin";
}
