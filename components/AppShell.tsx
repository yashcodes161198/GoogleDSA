import { AppNav } from "@/components/AppNav";
import { MobileTabBar } from "@/components/MobileTabBar";
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
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppNav email={email} localMode={localMode} />
      <main id="main-content" tabIndex={-1} className="app-main">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
