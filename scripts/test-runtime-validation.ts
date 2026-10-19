import assert from "node:assert/strict";
import { isSolveSeconds, requireIds, requireUuid, requireBoolean } from "../lib/validation";
import { validateInterviewConfig, DEFAULT_INTERVIEW_CONFIG, type InterviewConfig } from "../lib/interview/config";
import { updateProblemStatus, setProblemFavorite, saveProblemSolveTime, updateInterviewProblem, endInterviewSession } from "../app/actions";

async function main() {
const id = "00000000-0000-0000-0000-000000000001";
for (const value of [null, {}, [], NaN, Infinity, -Infinity, -1, 0, 1.5, 86401, "10"]) {
  assert.equal(isSolveSeconds(value), false);
  assert.ok(validateInterviewConfig(value as InterviewConfig));
}
assert.equal(isSolveSeconds(1), true);
assert.equal(isSolveSeconds(86400), true);
for (const value of [null, {}, [], 1, "true"]) assert.throws(() => requireBoolean(value));
for (const value of [null, {}, "", "../../x"]) assert.throws(() => requireUuid(value));
assert.throws(() => requireIds([id, id], 1));
for (const difficultyMix of [null, {}, [], { MEDIUM: 1 }, { EASY: 0, MEDIUM: 1, HARD: 0, OTHER: 1 }]) {
  assert.ok(validateInterviewConfig({ ...DEFAULT_INTERVIEW_CONFIG, difficultyMix } as InterviewConfig));
}
const ids = Array.from({ length: 1205 }, (_, n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`);
assert.equal(validateInterviewConfig({ ...DEFAULT_INTERVIEW_CONFIG, selectedProblemIds: ids }), null);
// These action calls must fail before cookie access, backend calls or local writes.
await assert.rejects(updateProblemStatus(id, "attempted" as never), /Invalid status/);
await assert.rejects(setProblemFavorite(id, "yes" as never), /Invalid boolean/);
await assert.rejects(updateInterviewProblem(id, id, {} as never), /Invalid boolean/);
await assert.rejects(endInterviewSession(id, "active" as never), /Invalid session status/);
for (const seconds of [NaN, Infinity, -1, 0, 0.5, 86401, "1"]) {
  const result = await saveProblemSolveTime(id, seconds as number);
  assert.equal(result.ok, false);
}
console.log("Runtime validation: malformed configs, full-catalog selections and invalid actions rejected before writes");

}
main().catch(error => { console.error(error); process.exitCode = 1; });
