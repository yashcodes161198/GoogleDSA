import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Production app with synthetic auth/data. All non-loopback traffic is blocked.
process.env.USE_LOCAL_DB = "false";
process.env.NEXT_PUBLIC_USE_LOCAL_DB = "false";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NODE_ENV = "production";
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const users = [1,2].map(n => ({ id: uid(n), email: `player${n}@example.invalid`, aud: "authenticated", app_metadata: {}, user_metadata: { full_name: `Player ${n}` } }));
const problems = Array.from({length:697},(_,i)=>({ id:uid(100+i),slug:`fixture-${i}`,title:`LIBRARY_SENTINEL ${i}`,
  difficulty:"HARD", frequency:100-i/10,acceptance_rate:50,link:`https://leetcode.com/problems/fixture-${i}/`,
  links:[{provider:"leetcode",url:`https://leetcode.com/problems/fixture-${i}/`}],topics:["Arrays"] }));
const progress = new Map(users.map(user=>[user.id,problems.slice(0,2).map((p,i)=>({user_id:user.id,problem_id:p.id,
  status:i===1?"solved":"unsolved",is_favorite:false,solved_at:"2026-01-01T00:00:00Z",ease_factor:2.5,
  interval_days:1,repetitions:0,next_review_at:null,last_reviewed_at:null,revision_count:0,last_revised_at:null,
  daily_revision_count:0,last_solve_seconds:null,best_solve_seconds:null,notes:"PRIVATE_NOTE_SENTINEL"}))]));
const created = new Date(Date.now()-60000).toISOString();
const threads = Array.from({length:25},(_,i)=>({id:uid(10000+i),user_id:users[0].id,display_name:"Player 1",body:`Thread ${i}`,
  parent_id:null,created_at:created,media_path:`${users[0].id}/${i}.gif`,media_kind:"gif",reply_count:i===24?45:0})).reverse();
const replies = Array.from({length:45},(_,i)=>({id:uid(20000+i),user_id:users[0].id,display_name:"Player 1",body:`Reply ${i}`,
  parent_id:threads[0].id,created_at:created,media_path:null,media_kind:null,reply_count:0})).reverse();
let events=Array.from({length:75},(_,i)=>({id:uid(30000+i),problem_id:problems[0].id,problem_title:"History question",
  event_type:"revision",difficulty:"HARD",revision_number:i+1,points:i===0?4:2,created_at:created})).reverse();
const day = new Date(Date.parse(created)+5.5*3600000).toISOString().slice(0,10);
const fixture = { libraryReads:0, favoriteWrites:0, failFavorite:false, delayFavorite:0 };
const before = (row,p) => !p.p_before || row.created_at<p.p_before || (row.created_at===p.p_before && row.id<p.p_id);
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async (input,init)=>{
  const url=new URL(typeof input==="string"?input:input.url??input.toString());
  if (["localhost","127.0.0.1"].includes(url.hostname)) return fetchOriginal(input,init);
  assert.equal(url.origin,"https://auth-test.supabase.co","fixture blocks external traffic");
  const headers=new Headers(init?.headers??input.headers);
  const user=users[headers.get("authorization")==="Bearer fixture-2"?1:0];
  const method=init?.method??input.method??"GET";
  if(url.pathname==="/auth/v1/user") return Response.json(user);
  if(url.pathname==="/rest/v1/problems" || url.pathname==="/rest/v1/user_problems") {
    const select=url.searchParams.get("select");
    assert.ok(select && !select.includes("*") && !select.split(",").includes("notes"),"library requests omit stored notes and wildcard columns");
    if(url.pathname.endsWith("/problems")) fixture.libraryReads++;
    const rows=url.pathname.endsWith("/problems")?problems:progress.get(user.id);
    return Response.json(rows.map(row=>Object.fromEntries(select.split(",").map(key=>[key,row[key]]))));
  }
  const p=init?.body?JSON.parse(String(init.body)):{};
  if(url.pathname.endsWith("/rpc/get_leaderboard_comments_page")) return Response.json((p.p_parent?replies.filter(row=>row.parent_id===p.p_parent):threads).filter(row=>before(row,p)).slice(0,21));
  if(url.pathname.endsWith("/rpc/get_weekly_leaderboard")) return Response.json([{user_id:users[0].id,display_name:"Player 1",points:events.reduce((n,e)=>n+e.points,0),rank:1}]);
  if(url.pathname.endsWith("/rpc/get_score_activity_page")) {
    const summary=[{day,action:"first-revision",points:events.filter(e=>e.revision_number===1).reduce((n,e)=>n+e.points,0),count:events.filter(e=>e.revision_number===1).length},
      {day,action:"later-revision",points:events.filter(e=>e.revision_number!==1).reduce((n,e)=>n+e.points,0),count:events.filter(e=>e.revision_number!==1).length}];
    return Response.json({events:events.filter(e=>before(e,p) && (!p.p_day||p.p_day===day) &&
      (p.p_action==="all"||(p.p_action==="first-revision"?e.revision_number===1:p.p_action==="later-revision"?e.revision_number>1:false))).slice(0,51),summary:p.p_summary?summary:[]});
  }
  if(url.pathname.endsWith("/rpc/mutate_problem_progress")) {
    fixture.favoriteWrites++;
    if(fixture.delayFavorite) await new Promise(resolve=>setTimeout(resolve,fixture.delayFavorite));
    if(fixture.failFavorite) return Response.json({code:"FIXTURE",message:"Injected favorite failure"},{status:500});
    const row=progress.get(user.id).find(row=>row.problem_id===p.p_problem_id);
    if(p.p_operation==="favorite") row.is_favorite=p.p_value;
    return Response.json({solvedAt:created,revisionCount:0,bestSeconds:12});
  }
  if(url.pathname==="/rest/v1/leaderboard_events" && method==="DELETE") {
    events=events.filter(e=>e.id!==url.searchParams.get("id")?.replace("eq.",""));
    return new Response(null,{status:204});
  }
  throw new Error(`Unhandled fixture request: ${method} ${url.pathname}`);
};
const runtime=process.env.CODEX_BROWSER_RUNTIME;
if(!runtime) throw new Error("Set CODEX_BROWSER_RUNTIME to the bundled node_modules directory.");
const require=createRequire(path.join(runtime,"package.json"));
const {chromium}=require("playwright");
const {default:next}=await import("next");
let handle;
const server=createServer((request,response)=>handle(request,response));
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const app=next({dev:false,hostname:"127.0.0.1",port:server.address().port,httpServer:server});
let browser;
try {
  await app.prepare(); handle=app.getRequestHandler();
  const base=`http://localhost:${server.address().port}`;
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const authenticate=async(n=1)=>{
    const user=users[n-1]; const session={access_token:`fixture-${n}`,refresh_token:`refresh-${n}`,expires_at:Math.floor(Date.now()/1000)+3600,user,token_type:"bearer"};
    await context.addCookies([{name:"sb-auth-test-auth-token",url:base,value:`base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`}]);
  };
  await authenticate();
  let imageRequests=0;
  await context.route("https://auth-test.supabase.co/**",route=>{
    if(route.request().url().includes("/storage/")) {imageRequests++;return route.fulfill({contentType:"image/gif",body:Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","base64")});}
    return route.fulfill({json:users[0]});
  });
  const page=await context.newPage(); const errors=[]; page.on("pageerror",error=>errors.push(error.message));
  let libraryRequests=0; page.on("request",request=>{if(new URL(request.url()).pathname==="/api/library") libraryRequests++;});
  const docs={};
  for(const route of ["settings","leaderboard"]) {
    const response=await context.request.get(`${base}/${route}`);const html=await response.text();
    assert.equal(response.status(),200);assert.ok(!html.includes("LIBRARY_SENTINEL")); assert.ok(!html.includes("PRIVATE_NOTE_SENTINEL"));docs[route]={bytes:Buffer.byteLength(html)};
  }
  assert.equal(fixture.libraryReads,0);
  await page.goto(`${base}/leaderboard`);
  await page.getByRole("heading",{name:"The conversation"}).waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  assert.equal(libraryRequests,0);assert.equal(fixture.libraryReads,0);
  assert.equal(await page.getByRole("list",{name:"Leaderboard comments",exact:true}).locator(":scope > li").count(),20);
  assert.ok(imageRequests<20,"below-fold media is not all fetched at initial paint");
  await page.getByRole("button",{name:"View 45 replies"}).click();
  const replyList=page.getByRole("list",{name:"Replies to Player 1",exact:true});
  await replyList.locator(":scope > li").nth(19).waitFor();
  await page.getByRole("button",{name:"Load earlier replies"}).click();
  await replyList.locator(":scope > li").nth(39).waitFor();
  await page.getByRole("button",{name:"Load earlier replies"}).click();
  await replyList.locator(":scope > li").nth(44).waitFor();
  await page.getByRole("button",{name:"Load earlier threads"}).click();
  assert.equal(await page.getByRole("list",{name:"Leaderboard comments",exact:true}).locator(":scope > li").count(),25);
  await page.goto(`${base}/settings`);
  const totals=page.getByRole("definition");
  await page.getByText("152 pts",{exact:true}).waitFor();
  assert.equal(await page.locator("li").filter({has:page.locator('time[datetime]')}).count(),50);
  await page.getByRole("button",{name:"Show earlier activity"}).click();
  await page.waitForFunction(()=>document.querySelectorAll('li time[datetime]').length===75);
  assert.ok((await totals.allTextContents()).includes("152 pts"));
  await page.getByRole("button",{name:"First revision",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('li time[datetime]').length===1);
  await page.getByText("4 pts",{exact:true}).waitFor();
  await page.getByRole("button",{name:"All actions",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('li time[datetime]').length===50);
  await page.getByRole("button",{name:/Delete 2 points/}).first().click();
  await page.getByRole("button",{name:"Delete award",exact:true}).click();
  await page.getByText("150 pts",{exact:true}).waitFor();
  assert.equal(libraryRequests,0);
  const nav=href=>page.locator(`a[href="${href}"]:visible`).first();
  await nav("/problems").click();
  await page.locator("table.problem-table tbody tr").first().waitFor();
  assert.equal(libraryRequests,1);assert.equal(fixture.libraryReads,1);
  const favorite=()=>page.locator("table.problem-table tbody tr").first().getByRole("button",{name:/favorite/});
  fixture.delayFavorite=300;
  await favorite().click();
  await nav("/revise").click();
  await page.getByRole("heading",{name:"LIBRARY_SENTINEL 1",exact:true}).waitFor();
  await nav("/problems").click();
  await page.waitForFunction(()=>document.querySelector("table.problem-table tbody tr button[aria-pressed='true']"));
  assert.equal(libraryRequests,1,"warm practice navigation reuses the store while saves finish");
  await page.reload();
  await page.waitForFunction(()=>document.querySelector("table.problem-table tbody tr button[aria-pressed='true']"));
  assert.equal(libraryRequests,2,"hard refresh rehydrates durable progress");
  fixture.failFavorite=true;fixture.delayFavorite=0;
  await favorite().click();
  await page.locator("p[role='alert']").waitFor();
  assert.equal(await favorite().getAttribute("aria-pressed"),"true","failed save rolls back");
  fixture.failFavorite=false;
  await authenticate(2);await page.reload();
  await page.locator("table.problem-table tbody tr").first().waitFor();
  assert.equal(await favorite().getAttribute("aria-pressed"),"false","account change clears previous progress");
  const api=await context.request.get(`${base}/api/library`);const payload=await api.json();
  assert.equal(payload.problems.length,697);assert.ok(!JSON.stringify(payload).includes("PRIVATE_NOTE_SENTINEL"));
  const unauthorized=await fetch(`${base}/api/discussion`);assert.equal(unauthorized.status,401);
  for(const endpoint of ["discussion?before=bad&id=bad","activity?now=invalid","activity?now=2026-10-19T08:00:00Z&filter=bad"]) {
    assert.equal((await context.request.get(`${base}/api/${endpoint}`)).status(),400);
  }
  assert.deepEqual(errors,[]);
  await mkdir("work/review-bounded-reads",{recursive:true});
  const result={passed:true,documents:docs,checks:["non-practice documents omit catalog/progress; no focus bootstrap","20-thread/reply pages","lazy media","50-event pages with full totals","action filters","deletion totals","one first-practice load","warm navigation with a pending save","durable refresh","failed-save rollback","account isolation","697 complete projected problems","anonymous/bad-input rejection"]};
  await writeFile("work/review-bounded-reads/browser-result.json",JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} catch(error) {console.error(error);process.exitCode=1;}
finally {await browser?.close();await new Promise(resolve=>server.close(resolve));await app.close();}
