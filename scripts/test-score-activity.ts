import assert from "node:assert/strict";
import {
  activityAction, activityBounds, activityDayKey, buildActivityDays,
  formatActivityTime, type ScoreActivity,
} from "../lib/activity";
import { getMemoryStore } from "../lib/memory/store";

const now = new Date("2026-10-11T16:00:00.000Z");
const { start, end } = activityBounds(now);
assert.equal(start.toISOString(), "2026-09-11T18:30:00.000Z");
assert.equal(end.toISOString(), "2026-10-11T16:00:00.001Z");
assert.equal(activityDayKey("2026-10-10T18:29:59Z"), "2026-10-10");
assert.equal(activityDayKey("2026-10-10T18:30:00Z"), "2026-10-11");
assert.match(formatActivityTime("2026-10-10T18:30:01Z"), /12:00:01 am/i);

const event = (id: string, created_at: string, points: number,
  revision_number: number | null = null): ScoreActivity => ({
  id, problem_id: "question", problem_title: "Question", difficulty: "HARD",
  event_type: revision_number === null ? "solve" : "revision",
  revision_number, points, created_at,
});
const events = [
  event("outside", "2026-09-11T18:29:59.999Z", 8),
  event("start", start.toISOString(), 8),
  event("yesterday", "2026-10-10T18:29:59.999Z", 4, 1),
  event("midnight", "2026-10-10T18:30:00.000Z", 2, 2),
  event("latest", now.toISOString(), 2, 8),
  event("future", "2026-10-11T16:00:01.000Z", 8),
];
const days = buildActivityDays(events, now);
assert.equal(days.length, 30);
assert.equal(days[0].key, "2026-09-12");
assert.equal(days[29].key, "2026-10-11");
assert.equal(days[0].points, 8);
assert.equal(days[28].points, 4);
assert.equal(days[29].points, 4);
assert.deepEqual(days[29].events.map((entry) => entry.id), ["latest", "midnight"]);
assert.equal(days.reduce((sum, day) => sum + day.points, 0), 16);
assert.equal(activityAction(events[1]), "solved");
assert.equal(activityAction(events[2]), "first-revision");
assert.equal(activityAction(events[3]), "later-revision");
assert.equal(activityAction(events[4]), "later-revision");
assert.equal(buildActivityDays(events, now, "solved").reduce((sum, day) => sum + day.points, 0), 8);
assert.equal(buildActivityDays(events, now, "first-revision").reduce((sum, day) => sum + day.points, 0), 4);
assert.equal(buildActivityDays(events, now, "later-revision")[29].events.length, 2);
assert.equal(buildActivityDays([], now).every((day) => day.points === 0 && day.events.length === 0), true);

// Exercise the same local award store used by solve, revision and interview actions.
const store = getMemoryStore();
const hard = store.getProblemsCatalog().find((problem) => problem.difficulty === "HARD")!;
const medium = store.getProblemsCatalog().find((problem) => problem.difficulty === "MEDIUM")!;
const user = "score-history-test";
store.awardSolve(user, hard.id, now);
store.awardSolve(user, hard.id, now);
store.awardRevision(user, hard.id, 1, now);
store.awardRevision(user, hard.id, 2, now);
store.awardRevision(user, hard.id, 2, now);
store.awardRevision(user, hard.id, 3, now);
store.awardSolve("another-user", medium.id, now);
store.awardSolve(user, medium.id, new Date("2026-09-11T18:29:59Z"));
const history = store.getScoreActivity(user, now);
assert.equal(history.length, 4, "duplicate awards, other users, and older events are excluded");
assert.equal(history.reduce((sum, entry) => sum + entry.points, 0), 16);
assert.equal(history.every((entry) => entry.problem_title === hard.title && entry.difficulty === "HARD"), true);
assert.equal(new Set(history.map((entry) => entry.id)).size, 4);
store.upsertUserProblem(user, hard.id, { status: "unsolved" });
assert.deepEqual(store.getScoreActivity(user, now), history, "changing progress does not rewrite awarded history");
assert.equal(store.getWeeklyLeaderboard(now).find((row) => row.user_id === user)?.points, 16,
  "history awards agree with the leaderboard");
console.log("score activity ok: IST bounds, action filters, stored points, user isolation, deduplication");
