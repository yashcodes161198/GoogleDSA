import { readFileSync } from "fs";
import { resolve } from "path";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

const component = readFileSync(
  resolve(process.cwd(), "components/StartInterviewButton.tsx"),
  "utf-8"
);
const actions = readFileSync(
  resolve(process.cwd(), "app/actions.ts"),
  "utf-8"
);

assert(
  component.includes("absolute left-1 top-1"),
  "toggle thumb should have a stable left position"
);
assert(
  component.includes('customize ? "translate-x-5" : "translate-x-0"'),
  "toggle thumb should move within the 48px track"
);
assert(
  !component.includes("Easy questions") && !component.includes('name="easyCount"'),
  "custom interview UI should not offer easy questions"
);
assert(
  component.includes("medium: 0") && component.includes("hard: 0"),
  "custom question counts should initialize to zero"
);
assert(
  actions.includes("EASY: 0"),
  "custom interview action should always request zero easy questions"
);

if (!process.exitCode) {
  console.log("Custom interview UI regression checks passed");
}
