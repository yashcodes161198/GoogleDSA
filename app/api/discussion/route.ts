import { getUser } from "@/lib/auth";
import { getLeaderboardComments } from "@/lib/data";
import { readCursor, UUID_PATTERN } from "@/lib/pagination";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!await getUser()) return Response.json({ error: "Not authenticated" }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  let cursor;
  const parent = params.get("parent");
  try {
    cursor = readCursor(params);
    if (parent !== null && !UUID_PATTERN.test(parent)) throw new Error("Invalid parent");
  } catch { return Response.json({ error: "Invalid discussion page" }, { status: 400, headers }); }
  const result = await getLeaderboardComments(parent, cursor);
  return Response.json(result, { status: result.error ? 503 : 200, headers });
}
