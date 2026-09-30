import { readFileSync } from "fs";
import { resolve } from "path";
import { normalizeTitle } from "../lib/problem-links";

export const CHECKLIST_FREQUENCY = 60;

export type ChecklistRow = {
  title: string;
  topic: string;
  hits: number;
  difficulty: string;
  storeAsDifficulty?: string;
  leetcode?: string;
  leetcodePremium?: boolean;
  gfg?: string;
  tuf?: string;
  tags: string;
};

export type ChecklistFile = {
  frequencyScale?: number;
  problems: ChecklistRow[];
};

export const TITLE_ALIASES: Record<string, string> = {
  [normalizeTitle("Count the Number of Inversions")]: normalizeTitle(
    "Count Inversions"
  ),
  [normalizeTitle("Find the Celebrity")]: normalizeTitle("Celebrity Problem"),
  [normalizeTitle("Longest Substring with At Most K Distinct Characters")]:
    normalizeTitle("Longest Substring With At Most K Distinct Characters"),
  [normalizeTitle("Longest Happy Prefix")]: normalizeTitle(
    "Longest happy prefix"
  ),
};

export function loadChecklistFile(): ChecklistFile {
  const checklistPath = resolve(process.cwd(), "data/leetcode-checklist-95.json");
  return JSON.parse(readFileSync(checklistPath, "utf-8")) as ChecklistFile;
}

export function buildChecklistMatchers(problems: ChecklistRow[]) {
  const titles = new Set<string>();
  const slugs = new Set<string>();

  for (const row of problems) {
    const nt = normalizeTitle(row.title);
    titles.add(nt);
    const alias = TITLE_ALIASES[nt];
    if (alias) titles.add(alias);
    if (row.leetcode) slugs.add(row.leetcode);
  }

  return { titles, slugs };
}

function leetcodeSlugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/leetcode\.com\/problems\/([^/]+)/);
  return m?.[1] ?? null;
}

export function rowMatchesChecklist(
  cols: string[],
  matchers: ReturnType<typeof buildChecklistMatchers>
): boolean {
  const title = cols[1];
  if (!title) return false;

  if (matchers.titles.has(normalizeTitle(title))) return true;

  const slug = leetcodeSlugFromUrl(cols[4]);
  if (slug && matchers.slugs.has(slug)) return true;

  const linksRaw = cols[6];
  if (linksRaw?.includes("leetcode.com/problems/")) {
    const m = linksRaw.match(/leetcode\.com\/problems\/([^/"\\]+)/);
    if (m?.[1] && matchers.slugs.has(m[1])) return true;
  }

  return false;
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else current += ch;
  }
  result.push(current);
  return result;
}

export function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
