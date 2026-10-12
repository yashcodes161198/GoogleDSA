import assert from "node:assert/strict";
import { nextProblemSort, sortProblems, type ProblemSort, type ProblemSortColumn } from "../lib/problems/sorting";
import type { ProblemWithProgress } from "../lib/types";

function problem(id: string, patch: Partial<ProblemWithProgress> = {}, count = 0, revisedAt: string | null = null): ProblemWithProgress {
  return {
    id, slug: id, title: id, difficulty: "MEDIUM", frequency: 50,
    acceptance_rate: 0, link: "", links: [], topics: [], status: "solved",
    user_problem: {
      user_id: "user", problem_id: id, status: "solved", notes: null,
      solved_at: "2026-09-01T00:00:00Z", ease_factor: 2.5, interval_days: 1,
      repetitions: 0, next_review_at: null, last_reviewed_at: null,
      revision_count: count, last_revised_at: revisedAt,
      last_solve_seconds: null, best_solve_seconds: null, is_favorite: false,
    },
    ...patch,
  };
}

const ids = (rows: ProblemWithProgress[]) => rows.map(row => row.id);
const columns: ProblemSortColumn[] = ["title", "difficulty", "frequency", "progress"];
for (const column of columns) {
  let sort: ProblemSort = nextProblemSort(null, column);
  assert.deepEqual(sort, { column, direction: "ascending" });
  sort = nextProblemSort(sort, column);
  assert.deepEqual(sort, { column, direction: "descending" });
  assert.equal(nextProblemSort(sort, column), null, "third click removes sorting");
}
assert.deepEqual(nextProblemSort({ column: "title", direction: "descending" }, "frequency"),
  { column: "frequency", direction: "ascending" }, "switching columns starts ascending");

const catalog = [
  problem("zebra", { difficulty: "HARD", frequency: 9.9 }),
  problem("Alpha", { difficulty: "MEDIUM", frequency: 80 }),
  problem("beta", { difficulty: "EASY", frequency: 10.1 }),
  problem("alpha", { difficulty: "MEDIUM", frequency: 50 }),
];
assert.deepEqual(ids(sortProblems(catalog, null)), ["beta", "Alpha", "alpha", "zebra"], "original difficulty order");
assert.deepEqual(ids(sortProblems(catalog, { column: "title", direction: "ascending" })), ["Alpha", "alpha", "beta", "zebra"]);
assert.deepEqual(ids(sortProblems(catalog, { column: "title", direction: "descending" })), ["zebra", "beta", "Alpha", "alpha"]);
assert.deepEqual(ids(sortProblems(catalog, { column: "difficulty", direction: "ascending" })), ["beta", "Alpha", "alpha", "zebra"]);
assert.deepEqual(ids(sortProblems(catalog, { column: "difficulty", direction: "descending" })), ["zebra", "Alpha", "alpha", "beta"]);
assert.deepEqual(ids(sortProblems(catalog, { column: "frequency", direction: "ascending" })), ["zebra", "beta", "alpha", "Alpha"]);
assert.deepEqual(ids(sortProblems(catalog, { column: "frequency", direction: "descending" })), ["Alpha", "alpha", "beta", "zebra"]);
assert.deepEqual(ids(catalog), ["zebra", "Alpha", "beta", "alpha"], "sorting does not mutate shared catalog");

const revisionRows = [
  problem("once-yesterday", {}, 1, "2026-10-10T12:00:00Z"),
  problem("twice-old", {}, 2, "2026-09-01T12:00:00Z"),
  problem("unsolved", { status: "unsolved", user_problem: null }),
  problem("once-two-weeks", {}, 1, "2026-09-27T12:00:00Z"),
  problem("solved"),
  problem("twice-new", {}, 2, "2026-10-09T12:00:00Z"),
  problem("five", {}, 5, "2026-09-01T12:00:00Z"),
  problem("four", {}, 4, "2026-10-10T12:00:00Z"),
];
assert.deepEqual(ids(sortProblems(revisionRows, { column: "progress", direction: "ascending" })),
  ["unsolved", "solved", "once-two-weeks", "once-yesterday", "twice-old", "twice-new", "four", "five"],
  "revision count takes priority over age; oldest first within equal counts");
assert.deepEqual(ids(sortProblems(revisionRows, { column: "progress", direction: "descending" })),
  ["five", "four", "twice-old", "twice-new", "once-two-weeks", "once-yesterday", "solved", "unsolved"],
  "descending reverses progress groups while retaining oldest first within each count");
const equalProgress = [problem("second"), problem("first")];
assert.deepEqual(ids(sortProblems(equalProgress, { column: "progress", direction: "ascending" })), ["second", "first"], "equal progress and timestamps retain catalog order");
const solvedOld = problem("solved-old");
solvedOld.user_problem!.solved_at = "2026-08-01T00:00:00Z";
assert.deepEqual(ids(sortProblems([problem("solved-new"), solvedOld], { column: "progress", direction: "ascending" })), ["solved-old", "solved-new"], "unrevised solved problems use solve age");
assert.deepEqual(ids(sortProblems([problem("reset", { status: "unsolved" }, 5), problem("solved")], { column: "progress", direction: "ascending" })), ["reset", "solved"], "unsolved status takes priority over stale revision history");

const manyRows = Array.from({ length: 100 }, (_, i) => problem(String(i), { frequency: 100 - i }));
assert.deepEqual(ids(sortProblems(manyRows, { column: "frequency", direction: "ascending" }).slice(0, 25)),
  Array.from({ length: 25 }, (_, i) => String(99 - i)), "sort full results before pagination");
assert.deepEqual(sortProblems([], null), []);
console.log("Problem sorting passed: three-state headers, all columns, revision counts and age, stable ties, original order, and pagination");
