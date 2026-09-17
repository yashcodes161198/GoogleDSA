import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config();

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

async function main() {
  if (!dbUrl) {
    console.error(
      "Set SUPABASE_DB_URL (Postgres connection string) to apply migrations, or run supabase/migrations/009_problem_links.sql in the Supabase SQL editor."
    );
    process.exit(1);
  }

  const { Client } = await import("pg");
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/009_problem_links.sql"),
    "utf-8"
  );
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log("Applied 009_problem_links.sql");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
