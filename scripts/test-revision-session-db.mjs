import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRevisionDb, revisionUser, otherRevisionUser } from "./fixtures/revision-db.mjs";

const db = await createRevisionDb();
const asUser = async id => {
  await db.exec("SET ROLE authenticated");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
};
const load = async (version = null) => (await db.query("SELECT get_revision_session($1) AS session", [version])).rows[0].session;
const revise = async id => db.query("SELECT mutate_problem_progress($1,'revise','{}', $2)", [id, randomUUID()]);
try {
  await db.exec(await readFile("supabase/migrations/027_revision_sessions.sql", "utf8"));
  await asUser(revisionUser);
  const initial = await load();
  assert.equal(initial.entries.length, 10);
  assert.deepEqual(await load(), initial, "repeated opening resumes the same account list");
  await Promise.all(initial.entries.slice(0, 5).map(entry => revise(entry.id)));
  assert.deepEqual(await load(), initial, "five revisions do not change the saved question IDs or baselines");
  const completed = async session => (await db.query(`SELECT count(*)::int AS n
    FROM jsonb_array_elements($1::jsonb) e JOIN user_problems up ON up.problem_id=(e->>'id')::uuid
    WHERE up.user_id=auth.uid() AND up.revision_count>(e->>'revisionCount')::integer`, [JSON.stringify(session.entries)])).rows[0].n;
  assert.equal(await completed(initial), 5);
  await db.exec("RESET ROLE");
  await db.exec("UPDATE user_problems SET last_revised_at=now()-interval '7 days' WHERE revision_count>0");
  await asUser(revisionUser);
  assert.deepEqual(await load(), initial, "older revision dates do not expire the list");
  assert.equal(await completed(initial), 5, "completion stays checked across days");

  const next = await load(initial.version);
  assert.equal(next.version, 2);
  assert.equal(next.entries.length, 10);
  for (const entry of initial.entries.slice(0, 5)) assert.ok(!next.entries.some(e => e.id === entry.id));
  for (const entry of initial.entries.slice(5)) assert.ok(next.entries.some(e => e.id === entry.id));
  assert.equal(await completed(next), 0);
  assert.deepEqual(await load(initial.version), next, "stale devices and network retries cannot replace the new list again");
  assert.deepEqual(await load(), next, "reloading resumes the replaced list");
  await assert.rejects(load(0), /Invalid revision session version/);
  await assert.rejects(db.query("SELECT * FROM private.revision_sessions"), /permission denied/);

  await asUser(otherRevisionUser);
  const empty = await load();
  assert.deepEqual(empty.entries, [], "a different account never sees another user's list");
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO user_problems(user_id,problem_id,status,solved_at) SELECT $1,id,'solved',now()-interval '3 days' FROM problems LIMIT 1", [otherRevisionUser]);
  await asUser(otherRevisionUser);
  assert.deepEqual(await load(), empty, "even an empty list remains unchanged until Replace revised");
  assert.equal((await load(empty.version)).entries.length, 1, "Replace can refill an empty list");
  await asUser(revisionUser);
  assert.deepEqual(await load(), next, "account switches leave the first account intact");
  await asUser("");
  await assert.rejects(load(), /Not authenticated/);
  await db.exec("SET ROLE anon");
  await assert.rejects(load(), /permission denied/);
  console.log("Revision session SQL passed: resume, five checks, cross-day completion, explicit replacement, stale-device retries, isolation, empty list, authorization, migration rerun");
} finally { await db.close(); }
