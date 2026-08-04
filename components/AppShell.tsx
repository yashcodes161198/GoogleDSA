import { AppNav } from "@/components/AppNav";
import { isLocalMode, LOCAL_ADMIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const localMode = isLocalMode();
  let email: string | null = null;

  if (localMode) {
    email = LOCAL_ADMIN.email;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AppNav email={email} localMode={localMode} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
