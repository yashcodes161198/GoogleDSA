import { requireUser, isAdminUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { SessionLibraryProvider } from "@/components/SessionLibraryProvider";
import { isLocalMode } from "@/lib/config";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return <SessionLibraryProvider key={user.id} userId={user.id}
    canAddQuestion={isAdminUser(user)} localMode={isLocalMode()}>
    <AppShell>{children}</AppShell>
  </SessionLibraryProvider>;
}
