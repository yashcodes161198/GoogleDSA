import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";

const runtime = process.env.SCORE_DB_TEST_RUNTIME;
if (!runtime) throw new Error("Set SCORE_DB_TEST_RUNTIME to a directory containing @electric-sql/pglite.");
const require = createRequire(path.resolve(runtime, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const problem = "00000000-0000-0000-0000-000000000003";
const second = "00000000-0000-0000-0000-000000000004";
const session = "00000000-0000-0000-0000-000000000005";
const act = async (operation, value, id = randomUUID(), pid = problem) =>
  (await db.query("SELECT mutate_problem_progress($1,$2,$3::jsonb,$4) AS result", [pid, operation, JSON.stringify(value), id])).rows[0].result;
const asUser = async (id, role = "authenticated") => {
  await db.exec(`SET ROLE ${role}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
};
try {
  await db.exec(`CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit BIGINT,allowed_mime_types TEXT[]);
    CREATE TABLE storage.objects(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id TEXT,name TEXT,created_at TIMESTAMPTZ DEFAULT now(),UNIQUE(bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql AS $$ SELECT string_to_array(name,'/') $$;
    GRANT USAGE ON SCHEMA storage TO authenticated,service_role;
    GRANT ALL ON storage.objects TO authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
    INSERT INTO auth.users VALUES ('${owner}','owner@example.invalid','{}'),('${other}','other@example.invalid','{}');`);
  for (const name of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort()) {
    let sql = await readFile(path.join("supabase/migrations", name), "utf8");
    // Storage tables model policy decisions; the external upload/serving service is not emulated.
    if (name.startsWith("021_")) {
      await db.query("INSERT INTO leaderboard_comments(user_id,body,created_at) VALUES ($1,'legacy','infinity')", [owner]);
    }
    if (name.startsWith("023_")) {
      await db.query("INSERT INTO problems(slug,title,difficulty,link) SELECT 'legacy-'||n,'Legacy '||n,'MEDIUM','https://example.invalid' FROM generate_series(1,25) n");
      await db.query("INSERT INTO interview_sessions(id,user_id,ends_at) VALUES ($1,$2,now()-interval '1 hour')",[session,owner]);
      await db.query("INSERT INTO interview_session_problems(session_id,problem_id,position) SELECT $1,id,1 FROM problems",[session]);
    }
    await db.exec(sql);
    if (name.startsWith("023_")) {
      assert.equal((await db.query("SELECT max(position) AS n FROM interview_session_problems WHERE session_id=$1",[session])).rows[0].n,25,"migration repairs more than 20 legacy rows with duplicated positions");
      await db.query("DELETE FROM interview_sessions WHERE id=$1",[session]);
      await db.exec("DELETE FROM problems WHERE slug LIKE 'legacy-%'");
    }
  }
  await db.query("INSERT INTO problems(id,slug,title,difficulty,link) VALUES ($1,'hard','Hard','HARD','https://example.invalid'),($2,'medium','Medium','MEDIUM','https://example.invalid')", [problem, second]);
  await asUser(owner);
  await assert.rejects(db.query("SELECT award_leaderboard_solve($1)", [problem]), /permission denied/);
  await assert.rejects(db.query("SELECT award_leaderboard_revision($1,1000000)", [problem]), /permission denied/);
  await assert.rejects(db.query("SELECT increment_user_problem_revision($1)", [problem]), /permission denied/);
  await assert.rejects(db.query("INSERT INTO user_problems(user_id,problem_id,revision_count) VALUES ($1,$2,999)", [owner, problem]), /permission denied/);
  await assert.rejects(act("revise", {}), /Only solved/);
  const solveRequest = randomUUID();
  assert.deepEqual(await act("status", "solved", solveRequest), await act("status", "solved", solveRequest));
  await assert.rejects(act("status", "unsolved", solveRequest), /already used/);
  const revisionRequest = randomUUID();
  assert.equal((await act("revise", {}, revisionRequest)).revisionCount, 1);
  assert.equal((await act("revise", {}, revisionRequest)).revisionCount, 1);
  assert.equal((await act("revise", {})).revisionCount, 2);
  await assert.rejects(act("revise", 1000000), /server controlled/);
  await act("favorite", true);
  await act("time", 20);
  assert.equal((await act("time", 90)).bestSeconds, 20);
  assert.deepEqual((await db.query("SELECT status,is_favorite,best_solve_seconds FROM user_problems")).rows[0],
    { status: "solved", is_favorite: true, best_solve_seconds: 20 });
  await db.exec("DELETE FROM leaderboard_events WHERE event_type='solve'");
  await act("status", "unsolved"); await act("status", "solved");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM leaderboard_events WHERE event_type='solve'")).rows[0].n, 0);
  await assert.rejects(db.query("UPDATE user_problems SET revision_count=999"), /permission denied/);
  await assert.rejects(db.query("DELETE FROM user_problems"), /permission denied/);
  await asUser(other);
  assert.equal((await db.query("SELECT * FROM user_problems")).rows.length, 0);
  await assert.rejects(db.query("DELETE FROM private.problem_award_state"), /permission denied/);
  await asUser("", "anon");
  await assert.rejects(act("status", "solved"), /permission denied/);
  await asUser(owner);
  for (const timestamp of ["infinity", "-infinity", "2000-01-01"]) {
    await assert.rejects(db.query("INSERT INTO leaderboard_comments(user_id,body,created_at) VALUES ($1,'bad',$2)", [owner, timestamp]), /permission denied/);
  }
  const comment = (await db.query("INSERT INTO leaderboard_comments(user_id,body) VALUES ($1,'good') RETURNING id", [owner])).rows[0].id;
  await db.query("UPDATE leaderboard_comments SET body='edited' WHERE id=$1", [comment]);
  assert.equal((await db.query("SELECT body FROM leaderboard_comments WHERE id=$1", [comment])).rows[0].body, "edited");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM leaderboard_comments WHERE NOT isfinite(created_at)")).rows[0].n, 0);
  await asUser(other);
  assert.equal((await db.query("UPDATE leaderboard_comments SET body='foreign' WHERE id=$1 RETURNING id", [comment])).rows.length, 0);
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO interview_sessions(id,user_id,ends_at) VALUES ($1,$2,now()+interval '1 hour')", [session, owner]);
  await db.query("INSERT INTO interview_session_problems(session_id,problem_id,position) VALUES ($1,$2,1)", [session, second]);
  // A failing award must roll back both progress and the interview completion.
  await db.exec(`CREATE FUNCTION reject_test_award() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected award failure'; END $$;
    CREATE TRIGGER reject_test_award BEFORE INSERT ON leaderboard_events FOR EACH ROW EXECUTE FUNCTION reject_test_award();`);
  await asUser(owner);
  const failedRequest = randomUUID();
  await assert.rejects(act("status", "solved", failedRequest, second), /injected award failure/);
  await assert.rejects(db.query("SELECT set_interview_problem_completed($1,$2,true)", [session, second]), /injected award failure/);
  assert.equal((await db.query("SELECT * FROM user_problems WHERE problem_id=$1", [second])).rows.length, 0);
  assert.equal((await db.query("SELECT completed FROM interview_session_problems")).rows[0].completed, false);
  await db.exec("RESET ROLE; DROP TRIGGER reject_test_award ON leaderboard_events");
  await asUser(other);
  await assert.rejects(db.query("SELECT set_interview_problem_completed($1,$2,true)", [session, second]), /Session not found/);
  await asUser(owner);
  await assert.rejects(db.query("SELECT set_interview_problem_completed($1,$2,true)", [session, problem]), /Problem not in session/);
  await db.query("SELECT set_interview_problem_completed($1,$2,true)", [session, second]);
  await db.query("SELECT finish_interview_session($1,'completed')", [session]);
  await db.query("SELECT finish_interview_session($1,'completed')", [session]);
  // The same retry identity succeeds after the earlier transaction rolled back.
  await act("status", "solved", failedRequest, second);
  await assert.rejects(db.query("SELECT set_interview_problem_completed($1,$2,false)",[session,second]),/Session has ended/);
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO problems(slug,title,difficulty,link) SELECT 'fixture-'||n,'Fixture '||n,'MEDIUM','https://example.invalid' FROM generate_series(1,25) n");
  const ids = (await db.query("SELECT id FROM problems ORDER BY slug DESC")).rows.map(r=>r.id);
  await asUser(owner);
  const start = async (chosen, mode="picked", requestId=randomUUID()) => (await db.query(
    "SELECT start_interview_session($1::uuid[],45,true,$2,$3) AS id", [chosen,mode,requestId])).rows[0].id;
  const startRequest=randomUUID();
  const picked = await start(ids.slice(0,25),"picked",startRequest);
  assert.equal(await start(ids.slice(0,25),"picked",startRequest),picked);
  assert.deepEqual((await db.query("SELECT problem_id FROM interview_session_problems WHERE session_id=$1 ORDER BY position",[picked])).rows.map(r=>r.problem_id),ids.slice(0,25));
  await assert.rejects(start(ids.slice(0,25),"random"),/at most 20/);
  await assert.rejects(start([ids[0],ids[0]]),/distinct/);
  await assert.rejects(start([randomUUID()]),/available/);
  assert.equal((await db.query("SELECT status FROM interview_sessions WHERE id=$1",[picked])).rows[0].status,"active");
  await db.exec("RESET ROLE");
  await db.exec(`CREATE FUNCTION reject_test_question() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.position=21 THEN RAISE EXCEPTION 'injected question failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_test_question BEFORE INSERT ON interview_session_problems FOR EACH ROW EXECUTE FUNCTION reject_test_question();`);
  await asUser(owner);
  await assert.rejects(start(ids),/injected question failure/);
  assert.equal((await db.query("SELECT status FROM interview_sessions WHERE id=$1",[picked])).rows[0].status,"active");
  await db.exec("RESET ROLE; DROP TRIGGER reject_test_question ON interview_session_problems");
  await asUser(owner);
  const full = await start(ids);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM interview_session_problems WHERE session_id=$1",[full])).rows[0].n,ids.length);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM interview_sessions WHERE status='active'")).rows[0].n,1);
  await assert.rejects(db.query("INSERT INTO interview_sessions(user_id,ends_at) VALUES ($1,now())",[owner]),/permission denied/);
  await assert.rejects(db.query("UPDATE interview_session_problems SET completed=true"),/permission denied/);
  await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('leaderboard-comment-media',$1)",[`${owner}/${randomUUID()}.png`]),/row-level security/);
  const reservation=(await db.query("SELECT reserve_comment_media(100,'png') AS path")).rows[0].path;
  await assert.rejects(db.query("SELECT finalize_comment_media($1)",[reservation]),/permission denied/);
  await assert.rejects(db.query("INSERT INTO leaderboard_comments(user_id,body,media_path,media_kind) VALUES ($1,'', $2,'sticker')",[owner,reservation]),/not available/);
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('leaderboard-comment-media',$1)",[reservation]);
  await asUser(owner,"service_role");
  await db.query("SELECT finalize_comment_media($1)",[reservation]);
  await asUser(owner);
  await db.query("INSERT INTO leaderboard_comments(user_id,body,media_path,media_kind) VALUES ($1,'', $2,'sticker')",[owner,reservation]);
  await assert.rejects(db.query("INSERT INTO leaderboard_comments(user_id,body,media_path,media_kind) VALUES ($1,'', $2,'sticker')",[owner,reservation]),/not available/);
  for(let i=0;i<4;i++) await db.query("SELECT reserve_comment_media(100,'png')");
  await assert.rejects(db.query("SELECT reserve_comment_media(100,'png')"),/rate limit/);
  const recent=(await db.query("SELECT count(*)::int AS n FROM leaderboard_comments WHERE user_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",[owner])).rows[0].n;
  for(let i=recent;i<10;i++) await db.query("INSERT INTO leaderboard_comments(user_id,body) VALUES ($1,'quota fixture')",[owner]);
  await assert.rejects(db.query("INSERT INTO leaderboard_comments(user_id,body) VALUES ($1,'excess')",[owner]),/posting limit/);
  await db.exec("RESET ROLE");
  await db.query("INSERT INTO private.comment_media_reservations(path,user_id,bytes,created_at) SELECT $1||'/'||gen_random_uuid()||'.png',$1::uuid,1,now()-interval '1 hour' FROM generate_series(1,100)",[other]);
  await asUser(other);
  await assert.rejects(db.query("SELECT reserve_comment_media(1,'png')"),/quota reached/);
  await db.exec("RESET ROLE");
  await db.query("DELETE FROM private.comment_media_reservations WHERE user_id=$1",[other]);
  await db.query("INSERT INTO private.comment_media_reservations(path,user_id,bytes,created_at) SELECT $1||'/'||gen_random_uuid()||'.png',$1::uuid,3145728,now()-interval '1 hour' FROM generate_series(1,16)",[other]);
  await asUser(other);
  await assert.rejects(db.query("SELECT reserve_comment_media(3145728,'png')"),/quota reached/);
  await db.exec("RESET ROLE");
  await db.query("UPDATE storage.objects SET created_at=now()-interval '2 hours'");
  const orphan=`${other}/${randomUUID()}.png`;
  await db.query("INSERT INTO storage.objects(bucket_id,name,created_at) VALUES ('leaderboard-comment-media',$1,now()-interval '2 hours')",[orphan]);
  await db.query("DELETE FROM auth.users WHERE id=$1",[other]);
  await asUser(owner,"service_role");
  assert.deepEqual((await db.query("SELECT * FROM expired_comment_media()")).rows,[{path:orphan}],"cleanup preserves referenced media and finds deleted-account objects");
  await db.exec("RESET ROLE");
  await db.query("UPDATE private.progress_write_limits SET minute_count=120 WHERE user_id=$1", [owner]);
  await asUser(owner);
  await assert.rejects(act("favorite", false), /write limit reached/);
  console.log("Database batch passed: trusted progress/awards, retries, ownership, rollback, quotas, finite timestamps, text edits, 25/full-catalog interviews and atomic failure, media reservations/finalization and orphan cleanup. Multi-connection concurrency and the live Storage service are not covered by PGlite.");
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
} finally { await db.close(); }
