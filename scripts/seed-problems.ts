import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config();

import { createClient } from "@supabase/supabase-js";
import { loadProblemsFromCsv } from "../lib/problems-csv";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function seed() {
  const problems = loadProblemsFromCsv().map((p) => ({
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    frequency: p.frequency,
    acceptance_rate: p.acceptance_rate,
    link: p.link,
    links: p.links,
    topics: p.topics,
  }));

  console.log(`Parsed ${problems.length} problems`);

  const deduped = Array.from(
    new Map(problems.map((p) => [p.slug, p])).values()
  );
  if (deduped.length !== problems.length) {
    console.warn(`Deduped ${problems.length - deduped.length} duplicate slugs before upsert`);
  }

  const batchSize = 100;
  let seededWithLinks = true;
  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    let { error } = await supabase
      .from("problems")
      .upsert(batch, { onConflict: "slug" });
    if (error?.code === "PGRST204" && String(error.message).includes("links")) {
      seededWithLinks = false;
      const slim = batch.map(({ links: _links, ...rest }) => rest);
      ({ error } = await supabase.from("problems").upsert(slim, { onConflict: "slug" }));
    }
    if (error) throw error;
    console.log(`Upserted ${Math.min(i + batchSize, deduped.length)} / ${deduped.length}`);
  }

  if (!seededWithLinks) {
    console.warn(
      "Seeded without links column. Run supabase/migrations/009_problem_links.sql in the Supabase SQL editor, then npm run seed again."
    );
  }

  console.log("Seed complete");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
