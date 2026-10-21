import assert from "node:assert/strict";
import { DEFAULT_PROBLEM_FILTERS, matchesLastActionRange, readProblemFilters, writeProblemFilters } from "../lib/problems/filters";
import { PROBLEM_PROGRESS_FILTERS } from "../lib/revision/problemProgressStatus";

const topics = ["Array", "Bit Manipulation [Concepts & Problems] · Advanced Maths"];
assert.deepEqual(readProblemFilters(new URLSearchParams(), topics), DEFAULT_PROBLEM_FILTERS);

const filters = {
  ...DEFAULT_PROBLEM_FILTERS,
  search: "sum & matrix + /?",
  difficulty: "HARD" as const,
  status: "revised-twice" as const,
  topic: topics[1],
  frequencyInput: "66.6",
  favoriteFilter: "FAVORITES" as const,
  actionFrom: "2026-10-01",
  actionTo: "2026-10-21",
  page: 2,
  pageSize: 25 as const,
};
const original = new URLSearchParams("added=1&difficulty=EASY&difficulty=MEDIUM");
const encoded = writeProblemFilters(original, filters);
assert.equal(original.toString(), "added=1&difficulty=EASY&difficulty=MEDIUM", "leave the input URL unchanged");
assert.equal(encoded.get("added"), "1", "retain unrelated query parameters");
assert.deepEqual(encoded.getAll("difficulty"), ["HARD"], "replace duplicate filter parameters");
assert.equal(encoded.get("page"), "3", "URLs use one-based page numbers");
assert.deepEqual(readProblemFilters(new URLSearchParams(encoded.toString()), topics), filters,
  "restore every filter, including encoded search text and topic names");

for (const [status] of PROBLEM_PROGRESS_FILTERS) {
  assert.equal(readProblemFilters(new URLSearchParams({ status })).status, status);
}
for (const pageSize of [25, 50, 100, "all"] as const) {
  const params = writeProblemFilters(new URLSearchParams(), { ...filters, pageSize });
  assert.equal(readProblemFilters(params).pageSize, pageSize);
}
for (const frequencyInput of ["0", "0.1", "100"]) {
  assert.equal(readProblemFilters(new URLSearchParams({ frequency: frequencyInput })).frequencyInput, frequencyInput);
}
for (const page of ["0", "-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
  assert.equal(readProblemFilters(new URLSearchParams({ page })).page, 0);
}
for (const frequency of ["-1", "101", "NaN", "Infinity"]) {
  assert.equal(readProblemFilters(new URLSearchParams({ frequency })).frequencyInput, "");
}
assert.deepEqual(readProblemFilters(new URLSearchParams(
  "difficulty=invalid&status=invalid&topic=unknown&favorites=yes&pageSize=0"
), topics), DEFAULT_PROBLEM_FILTERS, "invalid links fall back to usable defaults");

const cleared = writeProblemFilters(encoded, { ...DEFAULT_PROBLEM_FILTERS, pageSize: 25 });
assert.equal(cleared.toString(), "added=1&pageSize=25", "clear removes filters and pagination while preserving row count");
assert.equal(writeProblemFilters(new URLSearchParams(), DEFAULT_PROBLEM_FILTERS).toString(), "",
  "omit default values from the URL");

for (const invalid of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-10-00", "0000-01-01", "26-10-01", "2026-1-1", "invalid"]) {
  const parsed = readProblemFilters(new URLSearchParams({ actionFrom: invalid, actionTo: invalid }));
  assert.equal(parsed.actionFrom, "", `ignore invalid start date ${invalid}`);
  assert.equal(parsed.actionTo, "", `ignore invalid end date ${invalid}`);
}
assert.equal(readProblemFilters(new URLSearchParams({ actionFrom: "2024-02-29" })).actionFrom, "2024-02-29");

const progress = { solved_at: "2026-10-01T08:00:00Z", last_revised_at: "2026-10-20T09:00:00Z", last_reviewed_at: null };
assert.equal(matchesLastActionRange(progress, "2026-10-01", "2026-10-02"), false, "an older solve inside the range does not match a newer revision outside it");
assert.equal(matchesLastActionRange(progress, "2026-10-20", "2026-10-20"), true, "single-day range includes latest revision");
assert.equal(matchesLastActionRange({ ...progress, solved_at: "2026-10-21T08:00:00Z" }, "2026-10-20", "2026-10-20"), false, "a newer solve takes precedence over an older revision");
assert.equal(matchesLastActionRange({ ...progress, last_reviewed_at: "2026-10-21T08:00:00Z" }, "2026-10-21", "2026-10-21"), true, "include reviews as recorded actions");
assert.equal(matchesLastActionRange(progress, "2026-10-20", ""), true, "start-only range");
assert.equal(matchesLastActionRange(progress, "", "2026-10-19"), false, "end-only range");
assert.equal(matchesLastActionRange(progress, "2026-10-21", "2026-10-19"), false, "reversed range matches nothing");
for (const empty of [null, undefined, { solved_at: null, last_revised_at: null, last_reviewed_at: null }]) {
  assert.equal(matchesLastActionRange(empty, "", ""), true, "no date filter keeps untouched problems");
  assert.equal(matchesLastActionRange(empty, "2026-10-01", ""), false, "active date filter excludes untouched problems");
}
for (const [timestamp, matches] of [
  ["2026-10-19T18:29:59.999Z", false],
  ["2026-10-19T18:30:00.000Z", true],
  ["2026-10-20T18:29:59.999Z", true],
  ["2026-10-20T18:30:00.000Z", false],
] as const) {
  assert.equal(matchesLastActionRange({ solved_at: timestamp, last_revised_at: null, last_reviewed_at: null }, "2026-10-20", "2026-10-20"), matches, `inclusive IST day boundary: ${timestamp}`);
}
assert.equal(matchesLastActionRange({ ...progress, last_reviewed_at: "invalid" }, "2026-10-20", "2026-10-20"), true, "ignore malformed action timestamps");
console.log("Problem filters passed: URL round trips, clear, validation, latest action, open ranges, and inclusive IST boundaries");
