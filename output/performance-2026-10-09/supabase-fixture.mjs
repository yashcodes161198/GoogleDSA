import { readFileSync, appendFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { setTimeout } from 'node:timers/promises';

// Loaded only into the loopback benchmark process. Never deploy this preload.
const env = parse(readFileSync('.env'));
const origin = new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin;
const fixture = JSON.parse(readFileSync(new URL('./dashboard-fixture.json', import.meta.url)));
const originalFetch = globalThis.fetch;
const delayMs = Number(process.env.PERF_FIXTURE_DELAY_MS ?? 100);
const logPath = process.env.PERF_FIXTURE_LOG;
if (!logPath) throw new Error('PERF_FIXTURE_LOG required for isolated fixture');
globalThis.fetch = async function(input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin !== origin) {
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      throw new Error('Fixture process blocks all external fetches');
    }
    return originalFetch(input, init);
  }
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  const failProgress = url.pathname === '/rest/v1/user_problems' && process.env.PERF_FAIL_PROGRESS === 'true';
  let body;
  if (url.pathname === '/auth/v1/user') body = fixture.user;
  else if (url.pathname === '/rest/v1/problems' && method === 'GET') body = fixture.problems;
  else if (url.pathname === '/rest/v1/user_problems') {
    const id = url.searchParams.get('problem_id')?.replace(/^eq\./, '');
    const rows = id ? fixture.progress.filter(p => p.problem_id === id) : fixture.progress;
    if (method === 'GET') {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      body = headers.get('Accept')?.includes('object') ? rows[0] ?? null : rows;
    } else if (['POST', 'PATCH'].includes(method)) {
      const patch = JSON.parse(init?.body ?? await input.text());
      const problemId = patch.problem_id ?? id;
      let row = fixture.progress.find(p => p.problem_id === problemId);
      if (!row) { row = { problem_id: problemId, user_id: fixture.user.id, status: 'unsolved', revision_count: 0, is_favorite: false }; fixture.progress.push(row); }
      Object.assign(row, patch);
      body = row;
    } else throw new Error('Unexpected fixture progress method ' + method);
  }
  else if (url.pathname === '/rest/v1/rpc/increment_user_problem_revision') {
    const patch = JSON.parse(init?.body ?? await input.text());
    const row = fixture.progress.find(p => p.problem_id === patch.p_problem_id);
    if (!row) throw new Error('Fixture revision requires progress');
    row.revision_count++;
    row.last_revised_at = new Date().toISOString();
    body = row.revision_count;
  }
  else if (['/rest/v1/rpc/award_leaderboard_solve', '/rest/v1/rpc/award_leaderboard_revision'].includes(url.pathname)) body = true;
  else if (url.pathname === '/rest/v1/interview_sessions' && ['GET','PATCH'].includes(method)) body = [];
  else if (url.pathname === '/rest/v1/rpc/get_user_dashboard_stats' && method === 'POST') body = fixture.stats;
  else throw new Error('Unexpected fixture operation: ' + method + ' ' + url.pathname);
  if (failProgress) body = { message: 'Fixture progress unavailable', code: 'PGRST_FIXTURE', details: null, hint: null };
  appendFileSync(logPath, JSON.stringify({ at: Date.now(), method, path: url.pathname, delayMs }) + '\n');
  await setTimeout(delayMs);
  return new Response(JSON.stringify(body), { status: failProgress ? 503 : 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
};
