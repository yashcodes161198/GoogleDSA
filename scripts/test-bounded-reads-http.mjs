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
process.env.CSP_ENFORCE ??= "true";
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const users = [1,2].map(n => ({ id: uid(n), email: `player${n}@example.invalid`, aud: "authenticated", app_metadata: {}, user_metadata: { full_name: `Player ${n}` } }));
const problems = Array.from({length:1205},(_,i)=>({ id:uid(100+i),slug:`fixture-${i}`,title:`LIBRARY_SENTINEL ${i}`,
  difficulty:"HARD", frequency:100-Math.floor(i/2)/10,acceptance_rate:50,link:`https://leetcode.com/problems/fixture-${i}/`,
  links:[{provider:"leetcode",url:`https://leetcode.com/problems/fixture-${i}/`}],topics:["Arrays"] }));
const progress = new Map(users.map(user=>[user.id,problems.map((p,i)=>({user_id:user.id,problem_id:p.id,
  status:i===1||i>=1000?"solved":"unsolved",is_favorite:i===1204,solved_at:"2026-01-01T00:00:00Z",ease_factor:2.5,
  interval_days:1,repetitions:0,next_review_at:null,last_reviewed_at:null,revision_count:0,last_revised_at:null,
  daily_revision_count:0,last_solve_seconds:null,best_solve_seconds:null,notes:"PRIVATE_NOTE_SENTINEL"}))]));
const created = new Date(Date.now()-60000).toISOString();
const session={id:uid(90000),user_id:users[0].id,started_at:created,ends_at:created,status:"completed"};
const sessionProblems=problems.map((problem,i)=>({session_id:session.id,problem_id:problem.id,position:i+1,completed:true,notes:null,problem}));
const threads = Array.from({length:25},(_,i)=>({id:uid(10000+i),user_id:users[0].id,display_name:"Player 1",body:`Thread ${i}`,
  parent_id:null,created_at:created,media_path:`${users[0].id}/${i}.gif`,media_kind:"gif",reply_count:i===24?45:0})).reverse();
const replies = Array.from({length:45},(_,i)=>({id:uid(20000+i),user_id:users[0].id,display_name:"Player 1",body:`Reply ${i}`,
  parent_id:threads[0].id,created_at:created,media_path:null,media_kind:null,reply_count:0})).reverse();
let events=Array.from({length:75},(_,i)=>({id:uid(30000+i),problem_id:problems[0].id,problem_title:"History question",
  event_type:"revision",difficulty:"HARD",revision_number:i+1,points:i===0?4:2,created_at:created})).reverse();
const day = new Date(Date.parse(created)+5.5*3600000).toISOString().slice(0,10);
const fixture = { libraryReads:0, favoriteWrites:0, failFavorite:false, delayFavorite:0, failPage:false,
  requests:[], delayTime:0, failTime:false, timeWrites:0, failComplete:false, completed:false };
const activeSession={...session,id:uid(90001),user_id:users[1].id,status:"active",ends_at:new Date(Date.now()+3600000).toISOString()};
const before = (row,p) => !p.p_before || row.created_at<p.p_before || (row.created_at===p.p_before && row.id<p.p_id);
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async (input,init)=>{
  const url=new URL(typeof input==="string"?input:input.url??input.toString());
  if (["localhost","127.0.0.1"].includes(url.hostname)) return fetchOriginal(input,init);
  assert.equal(url.origin,"https://auth-test.supabase.co","fixture blocks external traffic");
  fixture.requests.push({path:url.pathname,query:url.search});
  const headers=new Headers(init?.headers??input.headers);
  const user=users[headers.get("authorization")==="Bearer fixture-2"?1:0];
  const method=init?.method??input.method??"GET";
  if(url.pathname==="/auth/v1/user") {
    if(method==="PUT") Object.assign(user.user_metadata,JSON.parse(String(init.body)).data);
    return Response.json(user);
  }
  if(url.pathname==="/rest/v1/interview_sessions") {
    if(url.searchParams.has("status")) return Response.json(null);
    return Response.json(url.searchParams.get("id")===`eq.${activeSession.id}`?activeSession:url.searchParams.has("id")?session:[session]);
  }
  if(url.pathname==="/rest/v1/interview_session_problems") {
    assert.equal(url.searchParams.get("order"),"position.asc");
    assert.equal(url.searchParams.get("limit"),"500");
    const after=Number(url.searchParams.get("position")?.replace(/^gt\./,"")??0);
    const rows=url.searchParams.get("session_id")===`eq.${activeSession.id}`?
      [{...sessionProblems[0],session_id:activeSession.id,completed:fixture.completed}]:sessionProblems;
    return Response.json(rows.filter(row=>row.position>after).slice(0,137));
  }
  if(url.pathname==="/rest/v1/problems" || url.pathname==="/rest/v1/user_problems") {
    const select=url.searchParams.get("select");
    assert.ok(select && !select.includes("*") && !select.split(",").includes("notes"),"library requests omit stored notes and wildcard columns");
    const key=url.pathname.endsWith("/problems")?"id":"problem_id";
    const after=url.searchParams.get(key)?.replace(/^gt\./,"");
    if(after && fixture.failPage) return Response.json({code:"FIXTURE",message:"Injected page failure"},{status:500});
    assert.equal(url.searchParams.get("order"),`${key}.asc`);
    assert.equal(url.searchParams.get("limit"),"500");
    if(url.pathname.endsWith("/problems") && !after) fixture.libraryReads++;
    const rows=url.pathname.endsWith("/problems")?problems:progress.get(user.id);
    // A configured cap below the client's requested limit must not truncate the library.
    return Response.json(rows.filter(row=>!after||row[key]>after).slice(0,137).map(row=>Object.fromEntries(select.split(",").map(key=>[key,row[key]]))));
  }
  const p=init?.body?JSON.parse(String(init.body)):{};
  if(url.pathname.endsWith("/rpc/get_revision_session")) return Response.json({version:1,
    entries:progress.get(user.id).filter(row=>row.status==="solved").slice(0,10).map(row=>({id:row.problem_id,revisionCount:row.revision_count}))});
  if(url.pathname.endsWith("/rpc/get_leaderboard_comments_page")) return Response.json((p.p_parent?replies.filter(row=>row.parent_id===p.p_parent):threads).filter(row=>before(row,p)).slice(0,21));
  if(url.pathname.endsWith("/rpc/get_weekly_leaderboard")) return Response.json([{user_id:users[0].id,display_name:"Player 1",points:events.reduce((n,e)=>n+e.points,0),rank:1}]);
  if(url.pathname.endsWith("/rpc/get_score_activity_page")) {
    const summary=[{day,action:"first-revision",points:events.filter(e=>e.revision_number===1).reduce((n,e)=>n+e.points,0),count:events.filter(e=>e.revision_number===1).length},
      {day,action:"later-revision",points:events.filter(e=>e.revision_number!==1).reduce((n,e)=>n+e.points,0),count:events.filter(e=>e.revision_number!==1).length}];
    return Response.json({events:events.filter(e=>before(e,p) && (!p.p_day||p.p_day===day) &&
      (p.p_action==="all"||(p.p_action==="first-revision"?e.revision_number===1:p.p_action==="later-revision"?e.revision_number>1:false))).slice(0,51),summary:p.p_summary?summary:[]});
  }
  if(url.pathname.endsWith("/rpc/set_interview_problem_completed")) {
    if(fixture.failComplete) return Response.json({code:"FIXTURE",message:"Injected completion failure"},{status:500});
    fixture.completed=p.p_completed;
    return Response.json(null);
  }
  if(url.pathname.endsWith("/rpc/mutate_problem_progress")) {
    if(p.p_operation==="time") {
      fixture.timeWrites++;
      if(fixture.delayTime) await new Promise(resolve=>setTimeout(resolve,fixture.delayTime));
      if(fixture.failTime) return Response.json({code:"FIXTURE",message:"Injected time failure"},{status:500});
      progress.get(user.id).find(row=>row.problem_id===p.p_problem_id).best_solve_seconds=p.p_value;
      return Response.json({solvedAt:created,revisionCount:0,bestSeconds:p.p_value});
    }
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
  await mkdir("work/review-bounded-reads",{recursive:true});
  const base=`http://localhost:${server.address().port}`;
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const authenticate=async(n=1)=>{
    const user=users[n-1]; const session={access_token:`fixture-${n}`,refresh_token:`refresh-${n}`,expires_at:Math.floor(Date.now()/1000)+3600,user,token_type:"bearer"};
    await context.addCookies([{name:"sb-auth-test-auth-token",url:base,value:`base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`}]);
  };
  await authenticate();
  let imageRequests=0;
  await context.route("**/*",route=>["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await context.route("https://auth-test.supabase.co/**",route=>{
    if(route.request().url().includes("/storage/")) {imageRequests++;return route.fulfill({contentType:"image/gif",body:Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7","base64")});}
    return route.fulfill({json:users[0]});
  });
  await context.addInitScript(() => {
    window.cspViolations=[];
    window.interactionTimings=[];
    for(const type of ["event","longtask"]) {
      if(!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      new PerformanceObserver(list=>window.interactionTimings.push(...list.getEntries().map(entry=>({
        type:entry.entryType,name:entry.name,startTime:entry.startTime,duration:entry.duration,interactionId:entry.interactionId,
      })))).observe({type,buffered:true,durationThreshold:16});
    }
    document.addEventListener("securitypolicyviolation",event=>window.cspViolations.push(event.effectiveDirective));
  });
  const page=await context.newPage(); const errors=[]; page.on("pageerror",error=>errors.push(error.message));
  let libraryRequests=0; page.on("request",request=>{if(new URL(request.url()).pathname==="/api/library") libraryRequests++;});
  const docs={};
  for(const route of ["settings","leaderboard"]) {
    const response=await context.request.get(`${base}/${route}`);const html=await response.text();
    assert.equal(response.status(),200);assert.ok(Buffer.byteLength(html)<650000,"non-practice document budget");assert.ok(!html.includes("LIBRARY_SENTINEL")); assert.ok(!html.includes("PRIVATE_NOTE_SENTINEL"));docs[route]={bytes:Buffer.byteLength(html)};
    assert.equal(response.headers()["x-frame-options"],"DENY");
    assert.equal(response.headers()["x-content-type-options"],"nosniff");
    const policy=response.headers()[process.env.CSP_ENFORCE==="true"?"content-security-policy":"content-security-policy-report-only"];
    const nonce=policy.match(/'nonce-([^']+)'/)?.[1];
    assert.ok(nonce && html.includes(`nonce="${nonce}"`),"rendered scripts carry the request policy nonce");
    assert.ok(!policy.includes("unsafe-eval"));
  }
  assert.equal(fixture.libraryReads,0);
  await page.goto(`${base}/leaderboard`);
  await page.getByRole("heading",{name:"The conversation"}).waitFor();
  await page.locator('input[type="file"]').setInputFiles({name:"preview.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMd8AAAAASUVORK5CYII=","base64")});
  const preview=page.getByRole("img",{name:"Selected attachment preview"});
  await preview.waitFor();
  assert.ok((await preview.getAttribute("src")).startsWith("blob:"));
  await page.getByRole("button",{name:"Remove attachment"}).click();
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
  await page.getByRole("list",{name:"Leaderboard comments",exact:true}).locator(":scope > li").nth(24).waitFor();
  assert.equal(await page.getByRole("list",{name:"Leaderboard comments",exact:true}).locator(":scope > li").count(),25);
  await page.goto(`${base}/settings`);
  await page.getByRole("radio",{name:"Dark",exact:true}).check();
  await page.getByText("Appearance saved.",{exact:true}).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-theme-mode"),"dark");
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme-mode"),"dark","theme save/reload works under CSP");
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
  await page.getByRole("heading",{name:"LIBRARY_SENTINEL 1000",exact:true}).waitFor();
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
  const apiStart=fixture.requests.length;
  const api=await context.request.get(`${base}/api/library`);const payload=await api.json();
  const refreshRequests=fixture.requests.slice(apiStart);
  assert.equal(refreshRequests.filter(r=>r.path==="/auth/v1/user").length,1,"refresh authenticates once");
  assert.ok(Buffer.byteLength(JSON.stringify(payload))<1500000,"complete library payload budget");
  assert.equal(payload.problems.length,1205);assert.ok(!JSON.stringify(payload).includes("PRIVATE_NOTE_SENTINEL"));
  assert.equal(payload.problems.filter(p=>p.status==="solved").length,206);
  assert.equal(payload.problems.at(-1).user_problem.is_favorite,true,"favorite beyond the first 1,000 progress rows survives");
  assert.deepEqual(payload.problems.map(p=>p.id),problems.map(p=>p.id),"frequency ties retain ID order");
  await page.goto(`${base}/problems?search=LIBRARY_SENTINEL%201204&favorites=1`);
  const lastRow=page.locator("table.problem-table tbody tr");
  await lastRow.first().waitFor();
  assert.equal(await lastRow.count(),1,"search/favorites reach beyond the first 1,000 rows");
  assert.ok((await lastRow.textContent()).includes("LIBRARY_SENTINEL 1204"));
  await page.goto(`${base}/problems`);
  await page.locator("table.problem-table tbody tr").first().waitFor();
  const trace=await context.newCDPSession(page);
  await trace.send("Tracing.start",{categories:"devtools.timeline,blink.user_timing",transferMode:"ReturnAsStream"});
  const mounted=()=>page.locator("[data-problem-id]");
  assert.equal(await mounted().count(),50);
  assert.equal(await page.getByRole("button",{name:/favorite/}).count(),50,"one favorite control per logical row");
  await page.screenshot({path:"work/review-bounded-reads/problems-desktop.png"});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await mounted().count(),50,"mobile retains one mounted representation");
  assert.equal(await page.getByRole("button",{name:/favorite/}).count(),50);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"mobile has no document overflow");
  const firstFavorite=mounted().first().getByRole("button",{name:/favorite/});
  await firstFavorite.focus();
  assert.equal(await firstFavorite.evaluate(element=>element===document.activeElement),true);
  await page.screenshot({path:"work/review-bounded-reads/problems-mobile.png"});
  await page.getByRole("combobox",{name:"Rows per page"}).selectOption("all");
  await page.waitForFunction(()=>document.querySelectorAll("[data-problem-id]").length===1205);
  assert.equal(await page.getByRole("button",{name:/favorite/}).count(),1205,"All mode mounts controls once");
  await page.getByRole("textbox",{name:"Search problems"}).fill("LIBRARY_SENTINEL 1204");
  await page.waitForFunction(()=>document.querySelectorAll("[data-problem-id]").length===1);
  const traceFinished=new Promise(resolve=>trace.once("Tracing.tracingComplete",resolve));
  await trace.send("Tracing.end");
  const {stream}=await traceFinished;
  let timeline="";
  for(;;) {
    const chunk=await trace.send("IO.read",{handle:stream});
    timeline+=chunk.base64Encoded?Buffer.from(chunk.data,"base64").toString():chunk.data;
    if(chunk.eof) break;
  }
  await trace.send("IO.close",{handle:stream});
  await mkdir("output/verification",{recursive:true});
  await writeFile(`output/verification/interaction-${process.env.CSP_ENFORCE}-timeline.json`,timeline);
  await writeFile(`output/verification/interaction-${process.env.CSP_ENFORCE}-events.json`,JSON.stringify(await page.evaluate(()=>window.interactionTimings),null,2));
  await page.setViewportSize({width:1440,height:1000});
  const dashboardStart=fixture.requests.length;
  const dashboard=await context.request.get(`${base}/dashboard`);
  assert.equal(dashboard.status(),200);
  const dashboardRequests=fixture.requests.slice(dashboardStart);
  assert.equal(dashboardRequests.filter(r=>r.path==="/rest/v1/problems"&&!new URLSearchParams(r.query).has("id")).length,1);
  assert.equal(dashboardRequests.filter(r=>r.path==="/rest/v1/user_problems"&&!new URLSearchParams(r.query).get("problem_id")?.startsWith("gt.")).length,1,"dashboard reads one progress snapshot");
  assert.ok(!dashboardRequests.some(r=>r.path.includes("get_user_dashboard_stats")),"no redundant stats RPC");
  fixture.failPage=true;
  assert.equal((await context.request.get(`${base}/api/library`)).status(),503,"failed later page never returns partial progress");
  fixture.failPage=false;
  await page.goto(`${base}/interview`);
  await page.getByRole("switch",{name:"Customize interview",exact:true}).click();
  await page.getByRole("radio",{name:"Pick questions",exact:true}).check();
  await page.getByRole("combobox",{name:"Find a question"}).fill("LIBRARY_SENTINEL 1204");
  await page.getByRole("option",{name:/LIBRARY_SENTINEL 1204/}).click();
  assert.equal(await page.locator('input[name="problemIds"]').inputValue(),problems.at(-1).id);
  const interview=await context.request.get(`${base}/interview/${session.id}`);
  assert.equal(interview.status(),200);
  const interviewHtml=await interview.text();
  assert.equal((interviewHtml.match(/id="question-/g)??[]).length,1205,"full picked session renders every paged question");
  assert.ok(interviewHtml.includes("LIBRARY_SENTINEL 1204"));
  assert.equal(await page.locator(`a[href="/interview/${session.id}"] ol > li`).count(),1205,"history summary retains the full session");
  await page.goto(`${base}/interview/${activeSession.id}`);
  const question=page.locator(`#question-${problems[0].id}`);
  await question.getByRole("button",{name:"Start",exact:true}).click();
  await page.waitForTimeout(1100);
  fixture.delayTime=1500;
  const complete=question.getByRole("checkbox");
  await complete.check();
  await question.getByText("Saving…",{exact:true}).waitFor({timeout:1000});
  assert.equal(fixture.completed,false,"completion is optimistic while time save is pending");
  assert.equal(await complete.isChecked(),true,"immediate completion feedback");
  await page.waitForFunction(()=>!document.querySelector(".practice-row-list")?.textContent.includes("Saving…"));
  assert.equal(fixture.completed,true);
  await complete.uncheck();
  await page.waitForFunction(()=>!document.querySelector(".practice-row-list")?.textContent.includes("Saving…"));
  fixture.delayTime=0;fixture.failTime=true;
  await question.getByRole("button",{name:"Start",exact:true}).click();
  await page.waitForTimeout(1100);
  await complete.check();
  await question.getByRole("button",{name:"Retry time save"}).waitFor();
  await page.waitForFunction(()=>!document.querySelector(".practice-row-list")?.textContent.includes("Saving…"));
  assert.equal(fixture.completed,true,"completion survives an independently reported time failure");
  fixture.failTime=false;
  await question.getByRole("button",{name:"Retry time save"}).click();
  await question.getByRole("button",{name:"Retry time save"}).waitFor({state:"hidden"});
  fixture.failComplete=true;
  await complete.uncheck();
  await page.getByRole("alert").filter({hasText:"Could not save this change"}).waitFor();
  await page.waitForFunction(()=>!document.querySelector(".practice-row-list")?.textContent.includes("Saving…"));
  assert.equal(await complete.isChecked(),true,"failed completion rolls back");
  fixture.failComplete=false;
  const unauthorized=await fetch(`${base}/api/discussion`);assert.equal(unauthorized.status,401);
  for(const endpoint of ["discussion?before=bad&id=bad","activity?now=invalid","activity?now=2026-10-19T08:00:00Z&filter=bad"]) {
    assert.equal((await context.request.get(`${base}/api/${endpoint}`)).status(),400);
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(await page.evaluate(()=>window.cspViolations),[],"enforced policy permits practice navigation/actions");
  const framePage=await context.newPage();
  const frameHost=`http://127.0.0.1:${server.address().port}/frame-fixture`;
  await framePage.route(frameHost,route=>route.fulfill({contentType:"text/html",body:`<iframe src="${base}/settings"></iframe>`}));
  const blockedFrame=framePage.waitForEvent("framenavigated",{predicate:frame=>frame.url().startsWith("chrome-error:")});
  await framePage.goto(frameHost);
  await blockedFrame;
  assert.ok(framePage.frames().some(frame=>frame.url().startsWith("chrome-error:")),"external iframe is rejected by enforced frame-ancestors");
  await framePage.close();
  await mkdir("work/review-bounded-reads",{recursive:true});
  const result={passed:true,mode:process.env.CSP_ENFORCE==="true"?"enforce":"report-only",documents:docs,backendCounts:{refresh:refreshRequests.length,dashboard:dashboardRequests.length},checks:["one refresh authentication","one dashboard snapshot; no stats RPC","single mobile/desktop/All control tree and keyboard focus","optimistic completion before delayed time save","time failure retry and completion failure rollback","non-practice documents omit catalog/progress; no focus bootstrap","20-thread/reply pages","lazy media and blob preview","50-event pages with full totals","action filters","deletion totals","one first-practice load","warm navigation with a pending save","durable refresh","failed-save rollback","account isolation","1205 complete projected problems/progress under a 137-row service cap","frequency tie ordering","search/favorites/revision/interview choices beyond row 1000","1205-question session details/history","failed later page rejects partial results","security headers and matching script nonces","CSP navigation/actions and theme persistence without violations","cross-origin frame blocked","anonymous/bad-input rejection"]};
  await writeFile(`work/review-bounded-reads/browser-${result.mode}-result.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} catch(error) {console.error(error);process.exitCode=1;}
finally {await browser?.close();await new Promise(resolve=>server.close(resolve));await app.close();}
