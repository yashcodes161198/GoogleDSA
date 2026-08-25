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

const best1 = store.saveSolveSeconds(userId, problemId, 300);
const row = store.getProblemsWithProgress(userId).find((p) => p.id === problemId);
if (row?.user_problem?.last_solve_seconds !== 300) {
  console.error("FAIL saveSolveSeconds did not persist last time");
  process.exit(1);
}
if (best1 !== 300 || row?.user_problem?.best_solve_seconds !== 300) {
  console.error("FAIL first save should set best to 300");
  process.exit(1);
}

const best2 = store.saveSolveSeconds(userId, problemId, 480);
const row2 = store.getProblemsWithProgress(userId).find((p) => p.id === problemId);
if (row2?.user_problem?.last_solve_seconds !== 480) {
  console.error("FAIL saveSolveSeconds did not update latest time");
  process.exit(1);
}
if (best2 !== 300 || row2?.user_problem?.best_solve_seconds !== 300) {
  console.error("FAIL slower second save should keep best at 300");
  process.exit(1);
}

const best3 = store.saveSolveSeconds(userId, problemId, 180);
const row3 = store.getProblemsWithProgress(userId).find((p) => p.id === problemId);
if (best3 !== 180 || row3?.user_problem?.best_solve_seconds !== 180) {
  console.error("FAIL faster third save should update best to 180");
  process.exit(1);
}

console.log("All solve timer tests passed");
