import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const destination = new URL("/dashboard", origin);
  if (next?.startsWith("/") && !next.startsWith("//")) {
    const candidate = new URL(next, origin);
    if (candidate.origin === origin) destination.href = candidate.href;
  }
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const sessionCookieName = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
    const supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          // Exchange the new code without refreshing a previous session in parallel.
          // Retain cookie names so Supabase can remove stale session chunks on success.
          getAll: () => request.cookies.getAll().map(cookie =>
            cookie.name === sessionCookieName || cookie.name.startsWith(`${sessionCookieName}.`)
              ? { ...cookie, value: "" }
              : cookie
          ),
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.warn("OAuth code exchange failed", { code: error.code, status: error.status });
  }

  response.headers.set("Location", `${origin}/login?error=auth`);
  return response;
}
