import {
  formValuesFromFormData,
  parseNewProblemForm,
  parseTopics,
  problemInsertRow,
} from "../lib/problems/parseNewProblemInput";
import { getMemoryStore } from "../lib/memory/store";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function fd(entries: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }
  return form;
}

const valid = parseNewProblemForm(
  fd({
    title: "Two Sum",
    difficulty: "MEDIUM",
    leetcodeUrl: "https://leetcode.com/problems/two-sum/",
    gfgUrl: "",
    tufUrl: "",
    topics: "Array, Hash Table, array",
    frequency: "50",
    acceptanceRate: "45.5",
  })
);
assert(valid.ok === true, "accept valid form");
if (valid.ok) {
  assert(valid.data.slug === "two-sum", "derive slug from LeetCode URL");
  assert(valid.data.link.includes("leetcode.com"), "prefer LeetCode primary link");
  assert(
    valid.data.topics.join(",") === "Array,Hash Table",
    "dedupe topics case-insensitively"
  );
  assert(valid.data.frequency === 50, "parse frequency");
}

const missingLinks = parseNewProblemForm(
  fd({
    title: "No links",
    difficulty: "HARD",
    leetcodeUrl: "",
    gfgUrl: "",
    tufUrl: "",
    topics: "",
    frequency: "",
    acceptanceRate: "",
  })
);
assert(missingLinks.ok === false, "reject missing links");
if (!missingLinks.ok) {
  assert(
    Boolean(missingLinks.fieldErrors?.leetcodeUrl),
    "surface link requirement on form"
  );
}

const badLeetcode = parseNewProblemForm(
  fd({
    title: "Bad URL",
    difficulty: "MEDIUM",
    leetcodeUrl: "https://example.com/foo",
    gfgUrl: "",
    tufUrl: "",
    topics: "",
    frequency: "0",
    acceptanceRate: "0",
  })
);
assert(badLeetcode.ok === false, "reject invalid LeetCode URL");

const defaults = parseNewProblemForm(
  fd({
    title: "GFG only",
    difficulty: "HARD",
    leetcodeUrl: "",
    gfgUrl: "https://www.geeksforgeeks.org/problems/sort-an-array/1",
    tufUrl: "",
    topics: "Sorting",
    frequency: "",
    acceptanceRate: "",
  })
);
assert(defaults.ok === true, "default numeric fields to zero");
if (defaults.ok) {
  assert(defaults.data.frequency === 0 && defaults.data.acceptance_rate === 0, "zero defaults");
  assert(defaults.data.slug.startsWith("gfg-"), "derive GFG slug prefix");
}

const outOfRange = parseNewProblemForm(
  fd({
    title: "Range",
    difficulty: "MEDIUM",
    leetcodeUrl: "https://leetcode.com/problems/x/",
    gfgUrl: "",
    tufUrl: "",
    topics: "",
    frequency: "101",
    acceptanceRate: "0",
  })
);
assert(outOfRange.ok === false, "reject frequency above 100");

assert(parseTopics(" a, b ,a,B ").join() === "a,b", "parseTopics helper");

const values = formValuesFromFormData(
  fd({ title: "  Hello ", difficulty: "hard", leetcodeUrl: "x" })
);
assert(values.title === "Hello" && values.difficulty === "HARD", "normalize form values");

const store = getMemoryStore();
const duplicatePayload = parseNewProblemForm(
  fd({
    title: "Unique Problem XYZ",
    difficulty: "MEDIUM",
    leetcodeUrl: "https://leetcode.com/problems/unique-problem-xyz/",
    gfgUrl: "",
    tufUrl: "",
    topics: "",
    frequency: "0",
    acceptanceRate: "0",
  })
);
assert(duplicatePayload.ok === true, "build row for duplicate test");
if (duplicatePayload.ok) {
  const row = problemInsertRow(duplicatePayload.data, "test-id-1");
  assert(store.addProblem(row).ok === true, "insert first custom problem");
  const row2 = problemInsertRow(duplicatePayload.data, "test-id-2");
  const dup = store.addProblem(row2);
  assert(dup.ok === false, "reject duplicate slug in local store");
}

console.log("New problem input tests passed");
