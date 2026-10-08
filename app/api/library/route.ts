import { getUser } from "@/lib/auth";
import { getProblemsWithProgress } from "@/lib/data";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401, headers });
  try {
    return Response.json({ userId: user.id, problems: await getProblemsWithProgress() }, { headers });
  } catch {
    return Response.json({ error: "Could not refresh your library" }, { status: 503, headers });
  }
}
