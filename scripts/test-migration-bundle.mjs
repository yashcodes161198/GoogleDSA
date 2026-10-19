import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { buildSecurityMigrationBundle, migrationFiles } from "./bundle-security-migrations.mjs";

const runtime = process.env.SCORE_DB_TEST_RUNTIME;
if (!runtime) throw new Error("Set SCORE_DB_TEST_RUNTIME to a directory containing @electric-sql/pglite.");
const require = createRequire(path.resolve(runtime, "package.json"));
const { PGlite } = require("@electric-sql/pglite");
const bundle = await buildSecurityMigrationBundle();
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const problem = "00000000-0000-0000-0000-000000000003";
const comment = "00000000-0000-0000-0000-000000000004";
const sql = name => readFile(path.join("supabase/migrations", name), "utf8");

for (const baseline of ["complete", "missing-018", "missing-018-019", "partial-018"]) {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
      GRANT USAGE ON SCHEMA auth TO authenticated,anon;
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit BIGINT,allowed_mime_types TEXT[]);
      CREATE TABLE storage.objects(bucket_id TEXT,name TEXT,created_at TIMESTAMPTZ DEFAULT now());
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql AS $$ SELECT string_to_array(name,'/') $$;
      GRANT USAGE ON SCHEMA storage TO authenticated;
      GRANT ALL ON storage.objects TO authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
      INSERT INTO auth.users VALUES ('${owner}','owner@example.invalid','{}'),('${other}','other@example.invalid','{}');`);
    for (const name of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql") && Number(n.slice(0,3)) <= 17).sort()) {
      await db.exec(await sql(name));
    }
    if (baseline === "complete") await db.exec(await sql("018_leaderboard_comment_media.sql"));
    if (baseline === "partial-018") await db.exec("ALTER TABLE public.leaderboard_comments ADD COLUMN media_path TEXT");
    if (baseline !== "missing-018-019") await db.exec(await sql("019_edit_own_leaderboard_comments.sql"));
    await db.query("INSERT INTO leaderboard_comments(id,user_id,body) VALUES ($1,$2,'Keep this comment')",[comment,owner]);
    await db.query("INSERT INTO problems(id,slug,title,difficulty,link) VALUES ($1,'fixture','Fixture','MEDIUM','https://example.invalid')",[problem]);
    if (baseline === "missing-018-019") {
      const original = "BEGIN;\n" + (await Promise.all(migrationFiles.map(sql))).join("\n") + "\nCOMMIT;";
      await assert.rejects(db.exec(original),error => error.code === "42703" && /media_path/.test(error.message));
      await db.exec("ROLLBACK");
      assert.equal((await db.query("SELECT to_regclass('private.problem_award_state') AS name")).rows[0].name,null,
        "failed original bundle leaves no committed migration-020 state");
    }
    if (baseline === "complete" || baseline === "partial-018") {
      const repair = await readFile("supabase/repairs/comment_media_prerequisites.sql","utf8");
      await db.exec(repair);
      await db.exec(repair);
    }
    await db.exec(bundle);
    assert.equal((await db.query("SELECT body FROM leaderboard_comments WHERE id=$1",[comment])).rows[0].body,"Keep this comment");
    assert.equal((await db.query("SELECT file_size_limit FROM storage.buckets WHERE id='leaderboard-comment-media'")).rows[0].file_size_limit,3145728);
    await db.exec("SET ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
    const loaded=(await db.query("SELECT * FROM get_leaderboard_comments() WHERE id=$1",[comment])).rows[0];
    assert.equal(loaded.media_path,null);
    assert.equal(loaded.media_kind,null);
    await db.query("UPDATE leaderboard_comments SET body='Edited' WHERE id=$1",[comment]);
    assert.equal((await db.query("SELECT body FROM leaderboard_comments WHERE id=$1",[comment])).rows[0].body,"Edited");
    await assert.rejects(db.query("INSERT INTO leaderboard_comments(user_id,body,created_at) VALUES ($1,'bad','infinity')",[owner]),/permission denied/);
    await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('leaderboard-comment-media',$1)",[`${owner}/unvalidated.png`]),/row-level security/);
    await assert.rejects(db.query("SELECT finalize_comment_media('unvalidated.png')"),/permission denied/);
    await db.query("SELECT mutate_problem_progress($1,'status','\"solved\"'::jsonb,gen_random_uuid())",[problem]);
    assert.equal((await db.query("SELECT status FROM user_problems")).rows[0].status,"solved");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[other]);
    assert.equal((await db.query("UPDATE leaderboard_comments SET body='Foreign' WHERE id=$1 RETURNING id",[comment])).rows.length,0);
    await db.exec("RESET ROLE");
    await assert.rejects(db.exec(bundle),/Migration 020 is already present/);
    await db.exec("ROLLBACK");
    assert.equal((await db.query("SELECT body FROM leaderboard_comments WHERE id=$1",[comment])).rows[0].body,"Edited");
    console.log(`Migration bundle passed: ${baseline}; comments preserved, owner edits, trusted scoring, restricted uploads/timestamps, rerun guard`);
  } finally { await db.close(); }
}
