import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRevisionDb, revisionUser } from "./fixtures/revision-db.mjs";

Object.assign(process.env, {
  USE_LOCAL_DB: "false", NEXT_PUBLIC_USE_LOCAL_DB: "false",
  NEXT_PUBLIC_SUPABASE_URL: "https://auth-test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  GOOGLEDSA_VERIFY_BUILD: "true", NODE_ENV: "production",
});
const db = await createRevisionDb();
const migration = await readFile("supabase/migrations/029_admin_question_deletion.sql", "utf8");
await db.exec(migration);
await db.exec(migration);
await db.exec(`CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS
  $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$`);
const problem = (await db.query("SELECT id FROM problems ORDER BY slug LIMIT 1")).rows[0].id;
await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [revisionUser]);
const saved = (await db.query("SELECT get_revision_session() AS value")).rows[0].value;
// Include the target explicitly so cleanup is tested independently of queue selection.
await db.query("UPDATE private.revision_sessions SET entries = $1 WHERE user_id = $2",
  [JSON.stringify([{ id: problem, revisionCount: 0 }, ...saved.entries.filter(entry => entry.id !== problem).slice(0, 9)]), revisionUser]);
const before = (await db.query("SELECT * FROM private.revision_sessions")).rows[0];
await db.query("INSERT INTO leaderboard_events(user_id,problem_id,event_type,difficulty,points) VALUES ($1,$2,'solve','MEDIUM',4)", [revisionUser, problem]);
await db.query("INSERT INTO interview_sessions(id,user_id,ends_at) VALUES ($1,$2,now()+interval '1 hour')", [problem, revisionUser]);
await db.query("INSERT INTO interview_session_problems(session_id,problem_id,position) VALUES ($1,$1,1)", [problem]);
await db.exec("SET ROLE anon");
await assert.rejects(db.query("DELETE FROM problems WHERE id=$1", [problem]), /permission denied/);
await db.exec("SET ROLE authenticated");
await db.query("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ user_metadata: { role: "admin" } })]);
assert.equal((await db.query("DELETE FROM problems WHERE id=$1 RETURNING id", [problem])).rows.length, 0);
await db.exec("RESET ROLE");

let fail = false;
let deletes = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
  if (["localhost", "127.0.0.1"].includes(url.hostname)) return originalFetch(input, init);
  assert.equal(url.origin, "https://auth-test.supabase.co", "fixture blocks external traffic");
  const headers = new Headers(init?.headers ?? input.headers);
  const admin = headers.get("authorization") === "Bearer delete-admin";
  if (url.pathname === "/auth/v1/user") return Response.json({
    id: revisionUser, aud: "authenticated", email: "delete@example.invalid",
    app_metadata: admin ? { role: "admin" } : {}, user_metadata: { role: "admin" },
  });
  assert.equal(url.pathname, "/rest/v1/problems");
  assert.equal(init?.method ?? input.method, "DELETE");
  deletes++;
  if (fail) return Response.json({ message: "Injected database failure" }, { status: 503 });
  const rows = await db.transaction(async tx => {
    await tx.exec("SET LOCAL ROLE authenticated");
    await tx.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ app_metadata: admin ? { role: "admin" } : {} })]);
    return (await tx.query("DELETE FROM problems WHERE id=$1 RETURNING id", [url.searchParams.get("id").replace(/^eq\./, "")])).rows;
  });
  return Response.json(rows);
};

const { default: next } = await import("next");
let handle;
const server = createServer((request, response) => handle(request, response));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const app = next({ dev: false, hostname: "127.0.0.1", port: server.address().port, httpServer: server });
try {
  await app.prepare();
  handle = app.getRequestHandler();
  const base = `http://localhost:${server.address().port}`;
  function cookie(admin) {
    const session = { access_token: admin ? "delete-admin" : "delete-user", refresh_token: "fixture-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: revisionUser }, token_type: "bearer" };
    return `sb-auth-test-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  }
  async function remove(id, status, auth = true, origin = base) {
    const response = await fetch(`${base}/api/questions/${id}`, { method: "DELETE",
      headers: { origin, ...(auth === null ? {} : { cookie: cookie(auth) }) } });
    assert.equal(response.status, status, await response.clone().text());
    assert.match(response.headers.get("cache-control"), /no-store/);
    return response.json();
  }
  await remove(problem, 401, null);
  await remove(problem, 403, false);
  await remove(problem, 403, true, "https://other.example");
  await remove("not-a-uuid", 400);
  assert.equal(deletes, 0, "denied requests never reach deletion");
  fail = true;
  await remove(problem, 503);
  assert.equal((await db.query("SELECT id FROM problems WHERE id=$1", [problem])).rows.length, 1);
  fail = false;
  assert.deepEqual(await remove(problem, 200), { deleted: true, id: problem });
  await remove(problem, 404);
  for (const table of ["user_problems", "interview_session_problems", "leaderboard_events"]) {
    assert.equal((await db.query(`SELECT problem_id FROM ${table} WHERE problem_id=$1`, [problem])).rows.length, 0);
  }
  const after = (await db.query("SELECT * FROM private.revision_sessions")).rows[0];
  assert.equal(after.version, before.version + 1);
  assert.deepEqual(after.entries, before.entries.filter(entry => entry.id !== problem));
  assert.equal((await db.query("SELECT count(*)::int AS count FROM problems")).rows[0].count, 19);
  console.log("Question deletion HTTP/database: auth, admin-only RLS, origin/UUID validation, errors, cascades, revision cleanup and migration retries passed");
} finally {
  await new Promise(resolve => server.close(resolve));
  await app.close();
  await db.close();
  globalThis.fetch = originalFetch;
}
