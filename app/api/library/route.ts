import { getUser } from "@/lib/auth";
import { getProblemsForUser } from "@/lib/data";
import { isLocalMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = isLocalMode() ? null : await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : await getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401, headers });
  try {
    return Response.json({ userId: user.id, problems: await getProblemsForUser(user.id, supabase) }, { headers });
  } catch {
    return Response.json({ error: "Could not refresh your library" }, { status: 503, headers });
  }
}
