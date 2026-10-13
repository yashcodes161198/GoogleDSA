import assert from "node:assert/strict";
import { mock } from "node:test";
import { computeStatsFromProblems, getDashboardStats } from "../lib/data";
import { getMemoryStore } from "../lib/memory/store";
import { isPracticeToday, practiceDayStart } from "../lib/practice-day";
import { selectRevisionQueue } from "../lib/revision/selectRevisionQueue";

async function main() {
  process.env.USE_LOCAL_DB = "true";
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-11T18:29:59.000Z") });
  const store = getMemoryStore();
  const problems = store.getProblemsCatalog();
  const userId = "dashboard-test-user";
  const [first, second, interview, unsolved] = problems;
  const stats = () => computeStatsFromProblems(store.getProblemsWithProgress(userId));

  assert.equal(stats().solvedToday, 0);
  assert.equal(stats().revisionsDoneToday, 0);
  store.upsertUserProblem(userId, first.id, {
    status: "solved", solved_at: new Date().toISOString(),
  });
  store.upsertUserProblem(userId, second.id, {
    status: "solved", solved_at: "2026-10-10T18:29:59.999Z",
    revision_count: 12, daily_revision_count: 8,
    last_revised_at: "2026-10-10T18:29:59.999Z",
  });
  store.upsertUserProblem(userId, unsolved.id, {
    status: "unsolved", solved_at: new Date().toISOString(),
  });
  assert.equal(stats().solvedToday, 1, "only current solved problems count");
  assert.equal(stats().solved, 2);
  assert.equal(stats().unsolved, problems.length - 2);
  assert.equal(stats().revisionsDoneToday, 0, "ignore yesterday's count");

  assert.equal(store.markRevised(userId, first.id), 1);
  assert.equal(stats().revisionsDoneToday, 1);
  assert.equal(store.markRevised(userId, first.id), 2);
  assert.equal(stats().revisionsDoneToday, 2, "repeated +1 on the same problem counts again");
  assert.equal(store.markRevised(userId, second.id), 13);
  assert.equal(stats().revisionsDoneToday, 3, "reset the previous daily count before incrementing");
  assert.equal(stats().solvedToday, 1, "revising an old solve is not a new solve");
  assert.equal(stats().solved, 2, "revising does not change total solved");
  assert.throws(() => store.markRevised(userId, unsolved.id));
  assert.equal(stats().revisionsDoneToday, 3, "failed revision does not increment");
  store.upsertUserProblem(userId, first.id, { status: "unsolved" });
  assert.equal(stats().revisionsDoneToday, 3, "keep revisions even if a problem is later marked unsolved");

  store.syncSolvedFromInterview(userId, interview.id);
  assert.equal(stats().solvedToday, 1, "interview solve contributes to today's solved problems");
  assert.equal(stats().solved, 2);
  const loaded = await getDashboardStats(store.getProblemsWithProgress(userId));
  assert.equal(loaded.solvedToday, 1);
  assert.equal(loaded.revisionsDoneToday, 3);

  assert.equal(practiceDayStart().valueOf(), Date.parse("2026-10-10T18:30:00.000Z"));
  assert.equal(isPracticeToday("2026-10-10T18:30:00.000Z"), true, "include midnight IST");
  assert.equal(isPracticeToday("2026-10-10T18:29:59.999Z"), false, "exclude previous IST day");
  assert.equal(isPracticeToday("2026-10-11T18:30:00.000Z"), false, "exclude next IST day");

  mock.timers.tick(1000);
  assert.equal(stats().solvedToday, 0, "solved today resets at midnight IST");
  assert.equal(stats().revisionsDoneToday, 0, "revised today resets at midnight IST");
  assert.equal(store.markRevised(userId, second.id), 14);
  assert.equal(stats().revisionsDoneToday, 1, "first revision of new day starts at one");
  for (let i = 0; i < 11; i++) store.markRevised(userId, second.id);
  assert.equal(stats().revisionsDoneToday, 12, "daily total includes increments beyond the queue limit");

  const revised = store.getProblemsWithProgress(userId).find(p => p.id === second.id)!;
  assert.equal(selectRevisionQueue([revised], { limit: 10 }).length, 0,
    "a question revised today is outside the queue cooldown");
  const legacy = { ...revised, user_problem: { ...revised.user_problem!, daily_revision_count: undefined } };
  assert.equal(computeStatsFromProblems([legacy]).revisionsDoneToday, 1,
    "legacy timestamp preserves the known revision before migration");
  assert.equal(computeStatsFromProblems([]).solvedToday, 0);
  assert.equal(computeStatsFromProblems([]).revisionsDoneToday, 0);
  mock.timers.reset();
  console.log("Dashboard stats passed: solves, interview solves, every revision increment, failures, and midnight IST");
}

main().catch(error => { mock.timers.reset(); console.error(error); process.exitCode = 1; });
