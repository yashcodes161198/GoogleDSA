/**
 * Appends checklist problems from data/leetcode-checklist-95.json to data/problems.csv.
 * Skips rows already present (title, alias, or LeetCode slug).
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  buildProblemLinks,
  dedupeLinks,
  deriveProblemSlug,
  normalizeTitle,
  preferredProblemLink,
} from "../lib/problem-links";
import {
  CHECKLIST_FREQUENCY,
  escapeCsv,
  loadChecklistFile,
  parseCsvLine,
  TITLE_ALIASES,
  type ChecklistRow,
} from "./checklist-95";

function leetcodeSlug(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/leetcode\.com\/problems\/([^/]+)/);
  return m?.[1] ?? null;
}

function loadExistingKeys(csvPath: string) {
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const dataStart = lines.findIndex((l) => l.startsWith("Difficulty,"));
  const rows = lines.slice(dataStart + 1);
  const titles = new Set<string>();
  const slugs = new Set<string>();
  for (const line of rows) {
    const cols = parseCsvLine(line);
    if (cols[1]) titles.add(normalizeTitle(cols[1]));
    const slug = leetcodeSlug(cols[4]);
    if (slug) slugs.add(slug);
    const linksRaw = cols[6];
    if (linksRaw?.includes("leetcode.com/problems/")) {
      const m = linksRaw.match(/leetcode\.com\/problems\/([^/"\\]+)/);
      if (m?.[1]) slugs.add(m[1]);
    }
  }
  return { lines, dataStart, titles, slugs };
}

function isDuplicate(
  row: ChecklistRow,
  titles: Set<string>,
  slugs: Set<string>
): boolean {
  const nt = normalizeTitle(row.title);
  if (titles.has(nt)) return true;
  const alias = TITLE_ALIASES[nt];
  if (alias && titles.has(alias)) return true;
  if (row.leetcode && slugs.has(row.leetcode)) return true;
  return false;
}

function leetcodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`;
}

function main() {
  const root = process.cwd();
  const csvPath = resolve(root, "data/problems.csv");
  const { problems } = loadChecklistFile();

  const { lines, dataStart, titles, slugs } = loadExistingKeys(csvPath);
  const header = lines[dataStart];
  const hasLinksCol = header.includes(",Links");
  const newHeader = hasLinksCol ? header : `${header},Links`;

  const bodyLines = lines.slice(dataStart + 1);
  const newRows: string[] = [];
  const usedSlugs = new Set(slugs);
  const skipped: string[] = [];

  for (const row of problems) {
    if (isDuplicate(row, titles, slugs)) {
      skipped.push(row.title);
      continue;
    }

    const storedDifficulty =
      row.storeAsDifficulty ??
      (row.difficulty.toUpperCase() === "EASY" ? "MEDIUM" : row.difficulty);

    const leetcode =
      row.leetcode && !row.leetcodePremium
        ? leetcodeUrl(row.leetcode)
        : null;

    const links = buildProblemLinks({
      leetcode,
      gfg: row.gfg ?? null,
      tuf: row.tuf ?? null,
    });

    const deduped = dedupeLinks(links);
    if (deduped.length === 0) continue;

    const primary = preferredProblemLink(deduped);
    if (!primary) continue;

    let slug = deriveProblemSlug(deduped, row.title);
    let n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${deriveProblemSlug(deduped, row.title)}-${n++}`;
    }
    usedSlugs.add(slug);

    const topics = `Checklist · ${row.topic} · ${row.tags}`;
    const linksJson = JSON.stringify(deduped);

    const csvRow = [
      storedDifficulty.toUpperCase(),
      row.title,
      String(CHECKLIST_FREQUENCY),
      "0",
      primary,
      topics,
      linksJson,
    ]
      .map(escapeCsv)
      .join(",");

    newRows.push(csvRow);
    titles.add(normalizeTitle(row.title));
    if (row.leetcode) slugs.add(row.leetcode);
  }

  const outLines = [...lines.slice(0, dataStart), newHeader, ...bodyLines, ...newRows];
  writeFileSync(csvPath, `${outLines.join("\n")}\n`, "utf-8");

  console.log(`Checklist: ${problems.length} defined, ${skipped.length} already in CSV, ${newRows.length} appended.`);
  if (newRows.length > 0) {
    console.log("\nAppended:");
    for (const line of newRows) {
      console.log(`  - ${parseCsvLine(line)[1]}`);
    }
  }
  console.log("\nRun: npm run sync-checklist-frequency (if existing rows need frequency=60).");
  console.log("Then: npm run seed");
}

main();
