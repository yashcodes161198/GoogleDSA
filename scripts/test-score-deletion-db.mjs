import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// Run the actual policies in an isolated Postgres runtime, never the user's database.
const runtime = process.env.SCORE_DB_TEST_RUNTIME;
if (!runtime) throw new Error("Set SCORE_DB_TEST_RUNTIME to a directory containing @electric-sql/pglite.");
const require = createRequire(path.resolve(runtime, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const problem = "00000000-0000-0000-0000-000000000003";

try {
  await db.exec(`
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE anon NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE public.problems (id UUID PRIMARY KEY, difficulty TEXT);
    INSERT INTO auth.users VALUES ('${owner}', 'owner@test.invalid', '{}'), ('${other}', 'other@test.invalid', '{}');
    INSERT INTO public.problems VALUES ('${problem}', 'MEDIUM');
  `);
  await db.exec(await readFile("supabase/migrations/013_leaderboard.sql", "utf8"));
  const migration = await readFile("supabase/migrations/016_delete_own_score_events.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);
  await db.exec("SET ROLE authenticated");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [owner]);
  await db.query("SELECT award_leaderboard_solve($1)", [problem]);
  await db.query("SELECT award_leaderboard_revision($1, 1)", [problem]);
  await db.query("SELECT award_leaderboard_revision($1, 2)", [problem]);
  const award = (await db.query("SELECT id FROM leaderboard_events WHERE revision_number = 2")).rows[0].id;

  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [other]);
  assert.equal((await db.query("DELETE FROM leaderboard_events WHERE id = $1 RETURNING id", [award])).rows.length, 0,
    "RLS blocks deleting another player's award even without an application ownership filter");
  await db.exec("SET ROLE anon");
  await assert.rejects(db.query("DELETE FROM leaderboard_events WHERE id = $1", [award]), /permission denied/);
  await db.exec("SET ROLE authenticated");
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [owner]);
  await assert.rejects(db.query("UPDATE leaderboard_events SET points = 999 WHERE id = $1", [award]), /permission denied/);
  assert.equal((await db.query("SELECT points FROM get_weekly_leaderboard()")).rows[0].points, 7);
  assert.equal((await db.query("DELETE FROM leaderboard_events WHERE id = $1 RETURNING id", [award])).rows.length, 1);
  assert.equal((await db.query("SELECT points FROM get_weekly_leaderboard()")).rows[0].points, 6);
  assert.equal((await db.query("DELETE FROM leaderboard_events WHERE id = $1 RETURNING id", [award])).rows.length, 0);
  assert.equal((await db.query("SELECT points FROM get_weekly_leaderboard()")).rows[0].points, 6);
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM leaderboard_events")).rows[0].count, 2);
  console.log("score deletion database ok: migration reruns, owner-only deletion, anonymous rejection, unchanged update privileges, weekly totals, retries");
} finally {
  await db.close();
}
