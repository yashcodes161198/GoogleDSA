import { formatDurationSeconds } from "../lib/format-duration";
import { getLocalUserId, getMemoryStore } from "../lib/memory/store";

const cases: [number, string][] = [
  [0, "0:00"],
  [45, "0:45"],
  [90, "1:30"],
  [3661, "1:01:01"],
];

for (const [seconds, expected] of cases) {
  const got = formatDurationSeconds(seconds);
  if (got !== expected) {
    console.error(`FAIL ${seconds}s => expected ${expected}, got ${got}`);
    process.exit(1);
  }
}

process.env.USE_LOCAL_DB = "true";
const store = getMemoryStore();
const userId = getLocalUserId();
const problems = store.getProblemsCatalog();
const problemId = problems[0].id;

store.saveLastSolveSeconds(userId, problemId, 125);
const row = store.getProblemsWithProgress(userId).find((p) => p.id === problemId);
if (row?.user_problem?.last_solve_seconds !== 125) {
  console.error("FAIL saveLastSolveSeconds did not persist");
  process.exit(1);
}

store.saveLastSolveSeconds(userId, problemId, 200);
const row2 = store.getProblemsWithProgress(userId).find((p) => p.id === problemId);
if (row2?.user_problem?.last_solve_seconds !== 200) {
  console.error("FAIL saveLastSolveSeconds did not update latest time");
  process.exit(1);
}

console.log("All solve timer tests passed");
