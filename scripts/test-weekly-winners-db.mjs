import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
    CREATE TABLE leaderboard_events(user_id UUID, points INTEGER, created_at TIMESTAMPTZ);
    INSERT INTO auth.users VALUES
      ('00000000-0000-0000-0000-000000000001','ada@example.invalid','{}'),
      ('00000000-0000-0000-0000-000000000002','grace@example.invalid','{}');
    WITH bounds AS (
      SELECT timezone('Asia/Kolkata', date_trunc('week', timezone('Asia/Kolkata',now()))) AS start
    ) INSERT INTO leaderboard_events
      SELECT u.id, v.points, b.start + v.delta FROM auth.users u CROSS JOIN bounds b
      CROSS JOIN (VALUES (8, interval '-7 days'), (4, interval '-21 days'),
        (999, interval '0 days'), (999, interval '-21 days -1 millisecond')) AS v(points, delta);
  `);
  const migration = await readFile("supabase/migrations/026_previous_weekly_winners.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);
  await db.exec("SET ROLE authenticated");
  const { rows } = await db.query("SELECT * FROM get_previous_weekly_winners()");
  assert.equal(rows.length, 4, "two joint winners in each active week");
  assert.deepEqual(rows.map(row => Number(row.points)), [8, 8, 4, 4], "current and older weeks excluded");
  assert.deepEqual(rows.map(row => row.display_name), ["ada", "grace", "ada", "grace"]);
  await db.exec("SET ROLE anon");
  await assert.rejects(db.query("SELECT * FROM get_previous_weekly_winners()"), /permission denied/);
  console.log("weekly winners SQL ok: reruns, joint winners, IST boundaries, completed weeks, authenticated access");
} finally { await db.close(); }
