import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// `cache()` memoizes the client per request, so every server component,
// route handler, and server action in a single request shares ONE Supabase
// client (and therefore one auth.getUser() round trip when combined with the
// cached getUser in lib/auth).
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; auth layout refreshes sessions on navigation.
          }
        },
      },
    }
  );
});
