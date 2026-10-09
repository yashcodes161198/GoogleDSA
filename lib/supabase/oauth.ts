import type { SupabaseClient } from "@supabase/supabase-js";

export async function signInWithGoogle(supabase: SupabaseClient, redirectTo: string) {
  // Expired-session cleanup removes PKCE storage. Finish it before creating a verifier.
  await supabase.auth.initialize();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}
