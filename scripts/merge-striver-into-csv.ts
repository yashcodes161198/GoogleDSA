/**
 * Appends new medium/hard Striver A2Z rows to data/problems.csv.
 * Skips problems already present in the Google dataset (LeetCode slug or title).
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

type StriverRow = {
  title: string;
  difficulty: string;
  section: string;
  subsection: string;
  leetcode: string | null;
  plus: string | null;
  article: string | null;
};

const ALIASES: Record<string, string> = {
  "sort an array of 0 s 1 s and 2 s": "sort-colors",
  "kadane s algorithm": "maximum-subarray",
  "longest consecutive sequence in an array": "longest-consecutive-sequence",
  "rotate matrix by 90 degrees": "rotate-image",
  "print the matrix in spiral manner": "spiral-matrix",
  "count subarrays with given sum": "subarray-sum-equals-k",
  "majority element ii": "majority-element-ii",
  "3 sum": "3sum",
  "4 sum": "4sum",
  "merge overlapping subintervals": "merge-intervals",
  "maximum product subarray in an array": "maximum-product-subarray",
  "search in rotated sorted array i": "search-in-rotated-sorted-array",
  "search in rotated sorted array ii": "search-in-rotated-sorted-array-ii",
  "minimum days to make m bouquets": "minimum-number-of-days-to-make-m-bouquets",
  "find the smallest divisor": "find-the-smallest-divisor-given-a-threshold",
  "split array largest sum": "split-array-largest-sum",
  "median of 2 sorted arrays": "median-of-two-sorted-arrays",
  "search in a 2d matrix": "search-a-2d-matrix",
  "search in a 2d matrix ii": "search-a-2d-matrix-ii",
  "koko eating bananas": "koko-eating-bananas",
  "find peak element": "find-peak-element",
  "single element in a sorted array": "single-element-in-a-sorted-array",
  "reverse pairs": "reverse-pairs",
  "set matrix zeroes": "set-matrix-zeroes",
  "next permutation": "next-permutation",
  "rearrange array elements by sign": "rearrange-array-elements-by-sign",
  "longest palindromic substring": "longest-palindromic-substring",
  "sum of beauty of all substrings": "sum-of-beauty-of-all-substrings",
  "count good numbers": "count-good-numbers",
  "generate parentheses": "generate-parentheses",
  "combination sum": "combination-sum",
  "combination sum ii": "combination-sum-ii",
  "string to integer atoi": "string-to-integer-atoi",
  "capacity to ship packages within d days": "capacity-to-ship-packages-within-d-days",
  "sort a linked list of 0 s 1 s and 2 s": "sort-colors",
  "djisktra s algorithm": "network-delay-time",
  "dijkstra s algorithm": "network-delay-time",
  "house robber": "house-robber-ii",
  "frog jump": "frog-jump",
};

function parseCsvLine(line: string): string[] {
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

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
  }
  return { lines, dataStart, titles, slugs };
}

function isDuplicate(row: StriverRow, titles: Set<string>, slugs: Set<string>): boolean {
  const nt = normalizeTitle(row.title);
  if (titles.has(nt)) return true;
  const lcSlug = leetcodeSlug(row.leetcode);
  if (lcSlug && slugs.has(lcSlug)) return true;
  const alias = ALIASES[nt];
  if (alias && slugs.has(alias)) return true;
  return false;
}

function main() {
  const root = process.cwd();
  const csvPath = resolve(root, "data/problems.csv");
  const striverPath = resolve(root, "data/striver-source.json");
  const gfgPath = resolve(root, "data/striver-gfg-by-title.json");

  const striver = JSON.parse(readFileSync(striverPath, "utf-8")) as StriverRow[];
  const gfgByTitle = JSON.parse(readFileSync(gfgPath, "utf-8")) as Record<string, string>;
  const { lines, dataStart, titles, slugs } = loadExistingKeys(csvPath);

  const header = lines[dataStart];
  const hasLinksCol = header.includes(",Links");
  const newHeader = hasLinksCol ? header : `${header},Links`;

  const bodyLines = lines.slice(dataStart + 1);
  const upgradedBody: string[] = [];

  for (const line of bodyLines) {
    const cols = parseCsvLine(line);
    if (cols.length < 6) continue;
    const [difficulty, title, frequency, acceptanceRate, link, topicsRaw, linksRaw] = cols;
    const linksJson =
      linksRaw?.trim() && linksRaw.startsWith("[")
        ? linksRaw
        : JSON.stringify(
            link.includes("leetcode.com")
              ? [{ provider: "leetcode", url: link }]
              : link.includes("geeksforgeeks.org")
                ? [{ provider: "gfg", url: link }]
                : link.includes("takeuforward.org")
                  ? [{ provider: "tuf", url: link }]
                  : [{ provider: "leetcode", url: link }]
          );
    upgradedBody.push(
      [difficulty, title, frequency, acceptanceRate, link, topicsRaw ?? "", linksJson]
        .map(escapeCsv)
        .join(",")
    );
  }

  const newRows: string[] = [];
  const usedSlugs = new Set(slugs);

  for (const row of striver) {
    if (isDuplicate(row, titles, slugs)) continue;

    const nt = normalizeTitle(row.title);
    const tuf = row.plus ?? row.article;
    const gfg = gfgByTitle[nt] ?? null;
    const links = buildProblemLinks({
      leetcode: row.leetcode,
      gfg,
      tuf,
    });
    if (!tuf && links.length === 0) continue;

    const primary = preferredProblemLink(links);
    if (!primary) continue;

    let slug = deriveProblemSlug(links, row.title);
    let n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${deriveProblemSlug(links, row.title)}-${n++}`;
    }
    usedSlugs.add(slug);

    const topics = [row.section, row.subsection].filter(Boolean).join(" · ");
    const linksJson = JSON.stringify(dedupeLinks(links));
    const csvRow = [
      row.difficulty,
      row.title,
      "0",
      "0",
      primary,
      topics,
      linksJson,
    ]
      .map(escapeCsv)
      .join(",");

    newRows.push(csvRow);
    titles.add(nt);
    const lc = leetcodeSlug(row.leetcode);
    if (lc) slugs.add(lc);
  }

  const outLines = [...lines.slice(0, dataStart), newHeader, ...upgradedBody, ...newRows];
  writeFileSync(csvPath, `${outLines.join("\n")}\n`, "utf-8");
  console.log(`Appended ${newRows.length} Striver problems to ${csvPath}`);
}

main();
