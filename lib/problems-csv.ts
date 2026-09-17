import { readFileSync } from "fs";
import { resolve } from "path";
import {
  deriveProblemSlug,
  parseProblemLinksJson,
  preferredProblemLink,
} from "@/lib/problem-links";
import type { Difficulty, Problem } from "@/lib/types";
import { randomUUID } from "crypto";

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
  const slugSeen = new Set<string>();

  return rows
    .map((line) => {
      const cols = parseCsvLine(line);
      const difficulty = cols[0];
      const title = cols[1];
      const frequency = cols[2];
      const acceptanceRate = cols[3];
      const link = cols[4];
      const topicsRaw = cols[5];
      const linksRaw = cols[6];

      if (!title || !link) return null;
      if (difficulty.toUpperCase() === "EASY") return null;

      const links = parseProblemLinksJson(linksRaw, link);
      const primaryLink = preferredProblemLink(links) || link;
      const slug = deriveProblemSlug(links, title);
      if (slugSeen.has(slug)) return null;
      slugSeen.add(slug);
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
        link: primaryLink,
        links,
        topics,
      } satisfies Problem;
    })
    .filter((p): p is Problem => p !== null);
}
