import { AppNav } from "@/components/AppNav";
import { MobileTabBar } from "@/components/MobileTabBar";
import { isLocalMode, LOCAL_ADMIN } from "@/lib/config";
import { getUser } from "@/lib/auth";
import { getCurrentDisplayName } from "@/lib/data";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const localMode = isLocalMode();
  const [user, displayName] = await Promise.all([getUser(), getCurrentDisplayName()]);
  const email = user?.email ?? (localMode ? LOCAL_ADMIN.email : null);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppNav email={email} displayName={displayName} localMode={localMode} />
      <main id="main-content" tabIndex={-1} className="app-main">
        {children}
      </main>
      <MobileTabBar />
    </div>
  );
}
