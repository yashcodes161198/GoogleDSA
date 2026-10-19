import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLocalMode } from "@/lib/config";
import { contentSecurityPolicy } from "@/lib/security-headers";

export async function proxy(request: NextRequest) {
  const policy = contentSecurityPolicy(
    Buffer.from(crypto.randomUUID()).toString("base64"),
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://localhost",
    process.env.NODE_ENV === "development",
  );
  const requestHeaders = new Headers(request.headers);
  // Next extracts this request nonce for framework/RSC scripts in both rollout modes.
  requestHeaders.set("Content-Security-Policy", policy);
  const makeResponse = () => {
    requestHeaders.set("cookie", request.cookies.toString());
    const next = NextResponse.next({ request: { headers: requestHeaders } });
    next.headers.set(process.env.CSP_ENFORCE === "true"
      ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", policy);
    return next;
  };
  let response = makeResponse();
  if (isLocalMode() || request.nextUrl.pathname === "/auth/callback") return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = makeResponse();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    }
  );

  // Only persist refresh/cleanup here; requireUser() verifies identity with getUser().
  // Reading a current session costs no Auth request, and is never used to authorize access.
  await supabase.auth.getSession();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
