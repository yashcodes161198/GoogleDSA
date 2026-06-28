import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config(); // fallback to .env if present

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { slugFromLeetCodeUrl } from "../lib/utils";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

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

async function seed() {
  const csvPath = resolve(process.cwd(), "data/problems.csv");
  const raw = readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());

  const dataStart = lines.findIndex((l) => l.startsWith("Difficulty,"));
  if (dataStart === -1) {
    throw new Error("Could not find CSV header row");
  }

  const rows = lines.slice(dataStart + 1);
  const problems = rows
    .map((line) => {
      const [difficulty, title, frequency, acceptanceRate, link, topicsRaw] =
        parseCsvLine(line);
      if (!title || !link) return null;
      const topics = (topicsRaw ?? "")
        .replace(/^"|"$/g, "")
        .split(", ")
        .map((t) => t.trim())
        .filter(Boolean);

      return {
        slug: slugFromLeetCodeUrl(link),
        title,
        difficulty: difficulty.toUpperCase(),
        frequency: parseFloat(frequency) || 0,
        acceptance_rate: parseFloat(acceptanceRate) || 0,
        link,
        topics,
      };
    })
    .filter(Boolean) as {
    slug: string;
    title: string;
    difficulty: string;
    frequency: number;
    acceptance_rate: number;
    link: string;
    topics: string[];
  }[];

  console.log(`Parsed ${problems.length} problems`);

  const batchSize = 100;
  for (let i = 0; i < problems.length; i += batchSize) {
    const batch = problems.slice(i, i + batchSize);
    const { error } = await supabase
      .from("problems")
      .upsert(batch, { onConflict: "slug" });
    if (error) throw error;
    console.log(`Upserted ${Math.min(i + batchSize, problems.length)} / ${problems.length}`);
  }

  console.log("Seed complete");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
