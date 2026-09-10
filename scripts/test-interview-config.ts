import {
  DEFAULT_INTERVIEW_CONFIG,
  getInterviewProblemCount,
  validateInterviewConfig,
} from "../lib/interview/config";
import { selectInterviewProblems } from "../lib/interview/selectProblems";
import { getLocalUserId, getMemoryStore } from "../lib/memory/store";
import type { Difficulty } from "../lib/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

process.env.USE_LOCAL_DB = "true";

assert(
  getInterviewProblemCount(DEFAULT_INTERVIEW_CONFIG) === 5,
  "default interview should contain 5 questions"
);
assert(
  validateInterviewConfig(DEFAULT_INTERVIEW_CONFIG) === null,
  "default interview config should be valid"
);
assert(
  validateInterviewConfig({
    difficultyMix: { EASY: 0, MEDIUM: 0, HARD: 0 },
    durationMinutes: 120,
  }) !== null,
  "an interview with no questions should be rejected"
);
assert(
  validateInterviewConfig({
    difficultyMix: { EASY: 1, MEDIUM: 3, HARD: 1 },
    durationMinutes: 10,
  }) !== null,
  "a duration below 15 minutes should be rejected"
);

const store = getMemoryStore();
const userId = getLocalUserId();
const problems = store.getProblemsWithProgress(userId);
const customMix: Record<Difficulty, number> = {
  EASY: 2,
  MEDIUM: 4,
  HARD: 2,
};
const selected = selectInterviewProblems(problems, customMix);

assert(selected.length === 8, "custom selection should contain 8 questions");
for (const difficulty of ["EASY", "MEDIUM", "HARD"] as const) {
  assert(
    selected.filter((problem) => problem.difficulty === difficulty).length ===
      customMix[difficulty],
    `custom selection should contain ${customMix[difficulty]} ${difficulty.toLowerCase()} questions`
  );
}
assert(
  new Set(selected.map((problem) => problem.id)).size === selected.length,
  "custom selection should not contain duplicate questions"
);

const sessionId = store.createInterviewSession(
  userId,
  selected.map((problem) => problem.id),
  true,
  90
);
const session = store.getInterviewSession(userId, sessionId)?.session;
assert(Boolean(session), "custom interview session should be created");

const durationMinutes =
  (new Date(session!.ends_at).getTime() -
    new Date(session!.started_at).getTime()) /
  60_000;
assert(durationMinutes === 90, "custom session should last 90 minutes");

console.log("All interview configuration tests passed");
