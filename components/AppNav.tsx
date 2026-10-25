"use client";

import { SelectionIndicator } from "@/components/interior/tabs";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navLinks } from "@/lib/nav-links";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Settings } from "lucide-react";

export function AppNav({
  email,
  displayName,
  localMode = false,
}: {
  email?: string | null;
  displayName: string;
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
        <details className="relative md:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
            Account
          </summary>
          <div className="surface absolute right-0 top-full z-50 mt-2 w-56 p-4">
            <p className="text-xs font-medium">
              {displayName}
            </p>
            <p className="mt-1 break-all text-xs text-muted">{email}</p>
            <Link href="/settings" className="nav-link mt-3"
              aria-current={pathname.startsWith("/settings") ? "page" : undefined}
              onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>
              <Settings size={16} aria-hidden="true" />Settings &amp; activity
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="mt-3 w-full justify-start"
            >
              <LogOut size={15} aria-hidden="true" /> Sign out
            </Button>
          </div>
        </details>
      </div>
      <nav
        className="mt-10 hidden space-y-1 md:block"
        aria-label="Main navigation"
      >
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="nav-link interior-choice"
            aria-current={pathname.startsWith(href) ? "page" : undefined}
          >
            <SelectionIndicator id="desktop-navigation" active={pathname.startsWith(href)} />
            <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="hidden md:mt-auto md:block">
        <Link href="/settings" className="nav-link mb-4 interior-choice"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}>
          <SelectionIndicator id="desktop-navigation" active={pathname.startsWith("/settings")} />
          <Settings size={18} strokeWidth={1.7} aria-hidden="true" />Settings &amp; activity
        </Link>
        <div className="sidebar-account">
          <span className="avatar" aria-hidden="true">
            {displayName[0]?.toUpperCase() ?? "G"}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium">
              {displayName}
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
