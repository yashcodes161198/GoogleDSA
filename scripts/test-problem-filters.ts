import assert from "node:assert/strict";
import { DEFAULT_PROBLEM_FILTERS, readProblemFilters, writeProblemFilters } from "../lib/problems/filters";
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
console.log("Problem filters passed: all filters, URL encoding, pagination, defaults, invalid links, and clear");
