import { redirect } from "next/navigation";
import { cache } from "react";
import { isLocalMode, LOCAL_ADMIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const getUser = cache(async () => {
  if (isLocalMode()) {
    return { id: LOCAL_ADMIN.id, email: LOCAL_ADMIN.email };
  }

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
  if (isLocalMode()) {
    redirect("/dashboard");
  }
  const user = await getUser();
  if (user) redirect("/dashboard");
}
