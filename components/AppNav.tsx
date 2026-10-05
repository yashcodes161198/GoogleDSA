"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navLinks } from "@/lib/nav-links";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut } from "lucide-react";

export function AppNav({
  email,
  localMode = false,
}: {
  email?: string | null;
  localMode?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const signOut = async () => {
    if (localMode) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <header className="app-sidebar">
      <div className="flex items-center justify-between gap-4 md:block">
        <Link href="/dashboard" className="brand md:px-2">
          <span className="brand-icon">
            <BookOpen size={19} aria-hidden="true" />
          </span>
          <span>Google DSA</span>
        </Link>
        <span className="text-xs text-muted md:hidden">Practice workspace</span>
      </div>
      <nav
        className="mt-10 hidden space-y-1 md:block"
        aria-label="Main navigation"
      >
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="nav-link"
            aria-current={pathname.startsWith(href) ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-auto md:block">
        <div className="sidebar-account">
          <span className="avatar" aria-hidden="true">
            {email?.[0]?.toUpperCase() ?? "G"}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium">
              {localMode ? "Local preview" : "Your workspace"}
            </p>
            <p
              className="mt-1 truncate text-xs text-muted"
              title={email ?? undefined}
            >
              {email}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="md:mt-3 md:w-full md:justify-start"
          aria-label="Sign out"
        >
          <LogOut size={15} aria-hidden="true" /> Sign out
        </Button>
      </div>
    </header>
  );
}
