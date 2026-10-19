import { getUser } from "@/lib/auth";
import { getScoreActivity } from "@/lib/data";
import { ACTIVITY_ACTIONS, type ActivityFilter } from "@/lib/activity";
import { readCursor, UUID_PATTERN } from "@/lib/pagination";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!await getUser()) return Response.json({ error: "Not authenticated" }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  let cursor;
  const userId = params.get("user") ?? undefined;
  const period = params.get("period") ?? "month";
  const filter = params.get("filter") ?? "all";
  const day = params.get("day");
  const now = new Date(params.get("now") ?? "");
  try {
    cursor = readCursor(params);
    if ((userId !== undefined && !UUID_PATTERN.test(userId)) ||
        (period !== "month" && period !== "week") ||
        (filter !== "all" && !ACTIVITY_ACTIONS.some(action => action === filter)) ||
        (day !== null && (!/^\d{4}-\d\d-\d\d$/.test(day) || !Number.isFinite(Date.parse(day)))) ||
        !Number.isFinite(now.getTime())) throw new Error("Invalid filters");
  } catch { return Response.json({ error: "Invalid activity page" }, { status: 400, headers }); }
  const result = await getScoreActivity(now, { userId, period: period as "month" | "week", cursor,
    filter: filter as ActivityFilter, day, includeSummary: false });
  return Response.json(result, { status: result.error ? 503 : 200, headers });
}
