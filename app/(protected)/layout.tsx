import { requireUser, isAdminUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { SessionLibraryProvider } from "@/components/SessionLibraryProvider";
import { getProblemsWithProgress } from "@/lib/data";
import { isLocalMode } from "@/lib/config";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, problems] = await Promise.all([requireUser(), getProblemsWithProgress()]);

  return <SessionLibraryProvider key={user.id} userId={user.id} initialProblems={problems}
    canAddQuestion={isAdminUser(user)} localMode={isLocalMode()}>
    <AppShell>{children}</AppShell>
  </SessionLibraryProvider>;
}
