/**
 * Sets frequency = CHECKLIST_FREQUENCY for every row that belongs to the 95-problem checklist.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  buildChecklistMatchers,
  CHECKLIST_FREQUENCY,
  escapeCsv,
  loadChecklistFile,
  parseCsvLine,
  rowMatchesChecklist,
} from "./checklist-95";
import { readFileSync } from "fs";

function main() {
  const csvPath = resolve(process.cwd(), "data/problems.csv");
  const { problems } = loadChecklistFile();
  const matchers = buildChecklistMatchers(problems);

  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const dataStart = lines.findIndex((l) => l.startsWith("Difficulty,"));
  const header = lines[dataStart];
  const bodyLines = lines.slice(dataStart + 1);

  let updated = 0;
  const outBody: string[] = [];

  for (const line of bodyLines) {
    const cols = parseCsvLine(line);
    if (cols.length < 3) {
      outBody.push(line);
      continue;
    }
    if (rowMatchesChecklist(cols, matchers)) {
      if (cols[2] !== String(CHECKLIST_FREQUENCY)) {
        cols[2] = String(CHECKLIST_FREQUENCY);
        updated += 1;
      }
      outBody.push(cols.map(escapeCsv).join(","));
    } else {
      outBody.push(line);
    }
  }

  const outLines = [...lines.slice(0, dataStart), header, ...outBody];
  writeFileSync(csvPath, `${outLines.join("\n")}\n`, "utf-8");

  console.log(
    `Set frequency=${CHECKLIST_FREQUENCY} on ${updated} row(s); ${problems.length} checklist problems defined.`
  );
}

main();
