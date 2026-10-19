import assert from "node:assert/strict";
import { getPreviousWeeklyWinners, getScoreActivity } from "../lib/data";
import { previousLeaderboardWeeks } from "../lib/leaderboard/points";
import { getMemoryStore } from "../lib/memory/store";
import { LOCAL_ADMIN } from "../lib/config";

async function main() {
  process.env.USE_LOCAL_DB = "true";
  const now = new Date("2026-10-18T18:30:00Z");
  const weeks = previousLeaderboardWeeks(now);
  assert.deepEqual(weeks.map(date => date.toISOString()), [
    "2026-10-11T18:30:00.000Z", "2026-10-04T18:30:00.000Z", "2026-09-27T18:30:00.000Z",
  ]);
  const store = getMemoryStore();
  const hard = store.getProblemsCatalog().find(problem => problem.difficulty === "HARD")!;
  const other = "00000000-0000-0000-0000-000000000002";
  store.awardSolve(other, hard.id, weeks[0]);
  store.awardSolve(LOCAL_ADMIN.id, hard.id, weeks[0]);
  store.awardRevision(other, hard.id, 1, weeks[2]);
  store.awardRevision(other, hard.id, 2, new Date(now.getTime() - 1));
  store.awardRevision(other, hard.id, 3, now);
  store.awardRevision(other, hard.id, 4, new Date(weeks[2].getTime() - 1));
  const result = await getPreviousWeeklyWinners(now);
  assert.equal(result.error, null);
  assert.deepEqual(result.weeks.map(week => week.winners.map(winner => winner.points)), [[10], [], [4]]);
  const history = await getScoreActivity(weeks[0], { userId: other, period: "week" });
  assert.equal(history.events.length, 2);
  assert.equal(history.summary.reduce((sum, row) => sum + row.points, 0), 10);
  store.deleteScoreActivity(other, history.events.find(event => event.event_type === "revision")!.id);
  const tied = await getPreviousWeeklyWinners(now);
  assert.equal(tied.weeks[0].winners.length, 2, "all joint winners appear");
  assert.deepEqual(tied.weeks[0].winners.map(winner => winner.points), [8, 8]);
  console.log("weekly winners ok: three completed IST weeks, empty weeks, ties, totals, historical activity");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
