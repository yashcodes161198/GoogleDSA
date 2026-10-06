import assert from "node:assert/strict";
import {
  DEFAULT_INTERVIEW_CONFIG,
  getInterviewProblemCount,
  validateInterviewConfig,
} from "../lib/interview/config";
import { selectChosenInterviewProblems } from "../lib/interview/selectProblems";
import { getMemoryStore, getLocalUserId } from "../lib/memory/store";

const store = getMemoryStore();
const userId = getLocalUserId();
const catalog = store.getProblemsWithProgress(userId);
const ids = catalog
  .slice(0, 25)
  .map((p) => p.id)
  .reverse();
const config = {
  ...DEFAULT_INTERVIEW_CONFIG,
  selectedProblemIds: ids,
  durationMinutes: 45,
};
assert.equal(
  validateInterviewConfig(config),
  null,
  "picked interviews accept more than 20 questions",
);
assert.equal(getInterviewProblemCount(config), 25);
assert.ok(validateInterviewConfig({ ...config, selectedProblemIds: [] }));
assert.ok(
  validateInterviewConfig({ ...config, selectedProblemIds: [ids[0], ids[0]] }),
);
assert.ok(validateInterviewConfig({ ...config, selectedProblemIds: [""] }));
assert.ok(validateInterviewConfig({ ...config, durationMinutes: 0 }));
assert.throws(
  () => selectChosenInterviewProblems(catalog, ["missing-question"]),
  /no longer available/,
);
const selected = selectChosenInterviewProblems(catalog, ids);
assert.deepEqual(
  selected.map((p) => p.id),
  ids,
  "manual selection preserves the supplied order",
);
const sessionId = store.createInterviewSession(
  userId,
  selected.map((p) => p.id),
  true,
  config.durationMinutes,
);
const session = store.getInterviewSession(userId, sessionId)!;
assert.deepEqual(
  session.problems.map((p) => p.problem_id),
  ids,
  "the session uses precisely the picked questions",
);
assert.equal(
  (new Date(session.session.ends_at).getTime() -
    new Date(session.session.started_at).getTime()) /
    60000,
  45,
);
console.log("Picked interview validation, ordering, and session tests passed");
