import assert from "node:assert/strict";
import { activityBounds, buildActivityDays } from "../lib/activity";
import { getScoreActivity } from "../lib/data";
import { LOCAL_ADMIN } from "../lib/config";
import { getMemoryStore } from "../lib/memory/store";

async function main() {
  process.env.USE_LOCAL_DB = "true";
  const now = new Date("2026-10-11T16:00:00.000Z");
  const { start, end } = activityBounds(now, "week");
  assert.equal(start.toISOString(), "2026-10-04T18:30:00.000Z");
  assert.equal(end.toISOString(), "2026-10-11T18:30:00.000Z");
  const store = getMemoryStore();
  const hard = store.getProblemsCatalog().find((problem) => problem.difficulty === "HARD")!;
  const otherUser = "00000000-0000-0000-0000-000000000002";
  store.awardSolve(otherUser, hard.id, start);
  store.awardRevision(otherUser, hard.id, 1, new Date("2026-10-05T18:29:59.999Z"));
  store.awardRevision(otherUser, hard.id, 2, new Date("2026-10-05T18:30:00.000Z"));
  store.awardRevision(otherUser, hard.id, 3, new Date(end.getTime() - 1));
  store.awardRevision(otherUser, hard.id, 4, end);
  store.awardRevision(otherUser, hard.id, 5, new Date(start.getTime() - 1));
  store.awardSolve(LOCAL_ADMIN.id, hard.id, now);

  const history = await getScoreActivity(now, { userId: otherUser, period: "week" });
  assert.equal(history.error, null, "a signed-in player can view another player's history");
  assert.equal(history.events.length, 4, "only this player's awards inside the board week are returned");
  const days = buildActivityDays(history.events, now, "all", "week");
  assert.deepEqual(days.map((day) => day.key), [
    "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
  ]);
  assert.deepEqual(days.map((day) => day.points), [12, 2, 0, 0, 0, 0, 2]);
  assert.deepEqual(days[0].events.map((event) => event.points), [4, 8], "awards are newest first");
  assert.equal(days.reduce((sum, day) => sum + day.points, 0),
    store.getWeeklyLeaderboard(now).find((entry) => entry.user_id === otherUser)?.points,
    "daily totals account for the entire leaderboard score");
  assert.equal(buildActivityDays(history.events, now, "solved", "week")[0].points, 8);
  assert.equal(buildActivityDays(history.events, now, "first-revision", "week")[0].points, 4);
  assert.equal(buildActivityDays(history.events, now, "later-revision", "week")[1].points, 2);
  assert.equal(history.events.every((event) => event.problem_title === hard.title), true);

  const ownHistory = await getScoreActivity(now);
  assert.equal(ownHistory.events.length, 1, "settings still defaults to the signed-in player's history");
  assert.equal(buildActivityDays(ownHistory.events, now).length, 30, "settings keeps its 30-day period");
  const empty = buildActivityDays([], now, "all", "week");
  assert.equal(empty.length, 7);
  assert.equal(empty.every((day) => day.points === 0 && day.events.length === 0), true);
  const monday = buildActivityDays(history.events, end, "all", "week");
  assert.equal(monday[0].key, "2026-10-12", "Monday 00:00 IST starts a new history week");
  assert.equal(monday.every((day) => day.points === 0), true, "previous week's awards do not leak into the new week");
  console.log("leaderboard history ok: cross-user access, IST days, week boundaries, daily totals, action filters, settings defaults");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
