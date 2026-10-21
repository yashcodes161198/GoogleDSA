import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

export const revisionUser = "00000000-0000-0000-0000-000000000001";
export const otherRevisionUser = "00000000-0000-0000-0000-000000000002";
export async function createRevisionDb() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_user_meta_data JSONB);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
    INSERT INTO auth.users VALUES ('${revisionUser}','revision@example.invalid','{}'),('${otherRevisionUser}','other@example.invalid','{}');`);
  for (const name of (await readdir("supabase/migrations")).filter(n => {
    const number = Number(n.slice(0, 3));
    return n.endsWith(".sql") && (number <= 17 || number === 20 || number === 27);
  }).sort()) await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.exec(`INSERT INTO problems(id,slug,title,difficulty,link)
    SELECT md5('revision-'||n)::uuid, 'revision-'||n, 'Revision question '||n, 'MEDIUM',
      'https://leetcode.com/problems/revision-'||n||'/' FROM generate_series(1,20) n;
    INSERT INTO user_problems(user_id,problem_id,status,solved_at)
    SELECT '${revisionUser}', md5('revision-'||n)::uuid, 'solved', now() - (40-n)*interval '1 day'
      FROM generate_series(1,20) n;`);
  return db;
}
