import { readFileSync } from "fs";
import { resolve } from "path";
import { slugFromLeetCodeUrl } from "@/lib/utils";
import type { Difficulty, Problem } from "@/lib/types";
import { randomUUID } from "crypto";

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function loadProblemsFromCsv(): Problem[] {
  const csvPath = resolve(process.cwd(), "data/problems.csv");
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());

  const dataStart = lines.findIndex((l) => l.startsWith("Difficulty,"));
  if (dataStart === -1) {
    throw new Error("Could not find CSV header row in data/problems.csv");
  }

  const rows = lines.slice(dataStart + 1);
  const slugToId = new Map<string, string>();

  return rows
    .map((line) => {
      const [difficulty, title, frequency, acceptanceRate, link, topicsRaw] =
        parseCsvLine(line);
      if (!title || !link) return null;

      const slug = slugFromLeetCodeUrl(link);
      let id = slugToId.get(slug);
      if (!id) {
        id = randomUUID();
        slugToId.set(slug, id);
      }

      const topics = (topicsRaw ?? "")
        .replace(/^"|"$/g, "")
        .split(", ")
        .map((t) => t.trim())
        .filter(Boolean);

      return {
        id,
        slug,
        title,
        difficulty: difficulty.toUpperCase() as Difficulty,
        frequency: parseFloat(frequency) || 0,
        acceptance_rate: parseFloat(acceptanceRate) || 0,
        link,
        topics,
      } satisfies Problem;
    })
    .filter((p): p is Problem => p !== null);
}
