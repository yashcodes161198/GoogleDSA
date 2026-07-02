import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// `cache()` makes auth.getUser() run at most once per request — the protected
// layout's requireUser(), every data helper, and server actions all share the
// same result instead of each making a network call to Supabase Auth.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function redirectIfAuthenticated() {
  const user = await getUser();
  if (user) redirect("/dashboard");
}
