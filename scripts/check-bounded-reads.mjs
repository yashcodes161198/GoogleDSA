import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

export async function checkBoundedReads(db, asUser, owner, problem) {
  await db.exec("RESET ROLE");
  await db.exec(`DELETE FROM leaderboard_comments; DELETE FROM leaderboard_events;
    ALTER TABLE leaderboard_comments DISABLE TRIGGER USER;
    INSERT INTO leaderboard_comments(id,user_id,body,created_at)
      SELECT md5('thread-'||n)::uuid,'${owner}','Thread '||n,'2026-10-19T08:00:00Z' FROM generate_series(1,10005) n;
    INSERT INTO leaderboard_comments(id,user_id,body,parent_id,created_at)
      SELECT md5('reply-'||n)::uuid,'${owner}','Reply '||n,md5('thread-1')::uuid,'2026-10-19T09:00:00Z' FROM generate_series(1,201) n;
    ALTER TABLE leaderboard_comments ENABLE TRIGGER USER;
    INSERT INTO leaderboard_events(user_id,problem_id,event_type,difficulty,revision_number,points,created_at)
      SELECT '${owner}','${problem}','revision','HARD',n,2,'2026-10-19T08:00:00Z' FROM generate_series(1,10005) n;
    ANALYZE leaderboard_events; ANALYZE leaderboard_comments;`);
  await asUser(owner);
  const first = (await db.query("SELECT * FROM get_leaderboard_comments_page()")).rows;
  assert.equal(first.length, 21);
  assert.ok(Buffer.byteLength(JSON.stringify(first)) < 15000, "first discussion payload stays bounded");
  let observedReplyCount = 0;
  const collect = async (parent = null) => {
    const ids = []; let before = null; let id = null;
    for (;;) {
      const rows = (await db.query("SELECT *,created_at::text AS cursor_at FROM get_leaderboard_comments_page($1,$2,$3)", [parent,before,id])).rows;
      const page = rows.slice(0,20);
      observedReplyCount = Math.max(observedReplyCount,...page.map(row=>Number(row.reply_count)));
      ids.push(...page.map(row => row.id));
      if (rows.length <= 20) break;
      before = page.at(-1).cursor_at; id = page.at(-1).id;
    }
    return ids;
  };
  const threads = await collect();
  assert.equal(threads.length, 10005);
  assert.equal(new Set(threads).size,10005,"tied timestamps traverse without missing or duplicate threads");
  const parent = (await db.query("SELECT md5('thread-1')::uuid AS id")).rows[0].id;
  assert.equal(observedReplyCount,201,"parent counts include replies outside any loaded reply page");
  assert.equal((await collect(parent)).length,201,"replies remain reachable independently of the visible thread page");
  assert.equal((await db.query("SELECT count(*)::int AS n FROM get_leaderboard_comments()")).rows[0].n,20);
  let before = null; let id = null; const events = [];
  for (;;) {
    const result = (await db.query("SELECT get_score_activity_page($1,'2026-10-18T18:30:00Z','2026-10-19T18:30:00Z',$2,$3,'all',NULL,$4) AS page",
      [owner,before,id,events.length===0])).rows[0].page;
    assert.ok(result.events.length <= 51);
    if (events.length === 0) {
      assert.equal(result.summary.reduce((sum,row)=>sum+Number(row.points),0),20010);
      assert.equal(result.summary.reduce((sum,row)=>sum+Number(row.count),0),10005);
      assert.ok(Buffer.byteLength(JSON.stringify(result))<30000,"first activity payload stays bounded");
    } else assert.deepEqual(result.summary,[],"later pages do not recompute/transfer period summaries");
    const page = result.events.slice(0,50);
    events.push(...page.map(row=>row.id));
    if (result.events.length <= 50) break;
    before=page.at(-1).created_at; id=page.at(-1).id;
  }
  assert.equal(events.length,10005);
  assert.equal(new Set(events).size,10005);
  const filtered = (await db.query("SELECT get_score_activity_page($1,'2026-10-18T18:30:00Z','2026-10-19T18:30:00Z',NULL,NULL,'first-revision','2026-10-19') AS page",[owner])).rows[0].page;
  assert.equal(filtered.events.length,1);
  assert.equal(filtered.summary.reduce((sum,row)=>sum+Number(row.points),0),20010,"filters never shrink period totals");
  await assert.rejects(db.query("SELECT get_score_activity_page($1,'2026-01-01','2026-10-19')",[owner]),/Invalid activity/);
  await asUser("", "anon");
  await assert.rejects(db.query("SELECT * FROM get_leaderboard_comments_page()"),/permission denied/);
  await assert.rejects(db.query("SELECT get_score_activity_page($1,now()-interval '1 day',now())",[owner]),/permission denied/);
  await db.exec("RESET ROLE");
  const plan = (await db.query(`EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM leaderboard_events
    WHERE user_id='${owner}' AND created_at>='2026-10-18T18:30:00Z' AND created_at<'2026-10-19T18:30:00Z'
    ORDER BY created_at DESC,id DESC LIMIT 51`)).rows;
  await mkdir("work/review-bounded-reads",{recursive:true});
  await writeFile("work/review-bounded-reads/history-plan-indexed.json",JSON.stringify(plan,null,2));
  await db.exec(`DELETE FROM leaderboard_events;
    INSERT INTO auth.users(id,email,raw_user_meta_data) SELECT md5('player-'||n)::uuid,n||'@example.invalid','{}' FROM generate_series(1,110) n;
    INSERT INTO leaderboard_events(user_id,problem_id,event_type,difficulty,revision_number,points)
      SELECT md5('player-'||n)::uuid,'${problem}','revision','HARD',1,4 FROM generate_series(1,110) n;
    INSERT INTO leaderboard_events(user_id,problem_id,event_type,difficulty,revision_number,points)
      VALUES ('${owner}','${problem}','revision','HARD',1,2);`);
  await asUser(owner);
  const board=(await db.query("SELECT * FROM get_weekly_leaderboard()")).rows;
  assert.equal(board.length,101);
  assert.equal(board.find(row=>row.user_id===owner).rank,111,"current player retains their global rank below the first page");
  assert.equal(board.filter(row=>row.points===4).every(row=>row.rank===1),true,"tie ranks survive the output bound");
  console.log("Bounded reads passed: 10,005 threads/events, 201 independent replies, stable cursor traversal, exact summaries/filters, anonymous rejection, 101-entry leaderboard with global ties/rank; EXPLAIN saved in work/review-bounded-reads.");
}
