import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeStatsFromProblems } from '../../lib/data';
import { selectRevisionQueue, REVISION_SOLVE_COOLDOWN_MS } from '../../lib/revision/selectRevisionQueue';
import { getMemoryStore } from '../../lib/memory/store';
import type { Problem, UserProblem, ProblemWithProgress } from '../../lib/types';

const fixture = JSON.parse(readFileSync('output/performance-2026-10-09/dashboard-fixture.json','utf8'));
const now = new Date(fixture.generatedAt);
const progress = new Map<string, UserProblem>(fixture.progress.map((p: UserProblem) => [p.problem_id,p]));
const problems: ProblemWithProgress[] = fixture.problems.map((p: Problem) => ({
  ...p, user_problem: progress.get(p.id) ?? null, status: progress.has(p.id) ? 'solved' : 'unsolved',
}));
const stats = computeStatsFromProblems(problems);
for (const key of ['total','solved','unsolved','reviewsDue','byDifficulty','topicCoverage'] as const) {
  assert.deepEqual(stats[key],fixture.stats[key], key + ' matches independent aggregate fixture');
}
assert.equal(stats.revisionsDoneToday,3);
assert.equal(stats.revisionsDueToday,7);

// Same populated data through the prior memory-loader path and direct selector.
const store = getMemoryStore();
store.problems = fixture.problems;
store.userProblems.clear();
for (const row of fixture.progress) store.userProblems.set(row.user_id + ':' + row.problem_id,row);
assert.deepEqual(
  selectRevisionQueue(problems,{limit:10,now}).map(p=>p.id),
  store.getDailyRevisions(fixture.user.id,10,{now}).map(p=>p.id),
);
const queue = selectRevisionQueue(problems,{limit:10,now});
assert.equal(queue.length,10);
assert(queue.every(p => now.getTime() - new Date(p.user_problem!.solved_at!).getTime() >= REVISION_SOLVE_COOLDOWN_MS));
assert(queue.slice(0,3).every(p=>p.user_problem?.last_revised_at === fixture.generatedAt));
assert.equal(computeStatsFromProblems([]).total,0);
assert.deepEqual(computeStatsFromProblems([]).topicCoverage,[]);
const emptyProgress = problems.map(p=>({...p,status:'unsolved' as const,user_problem:null}));
assert.equal(computeStatsFromProblems(emptyProgress).solved,0);
assert.equal(selectRevisionQueue(emptyProgress,{limit:10,now}).length,0);

const before = JSON.parse(readFileSync('output/performance-2026-10-09/dashboard-before-sections.json','utf8'));
const after = JSON.parse(readFileSync('output/performance-2026-10-09/dashboard-after-sections.json','utf8'));
assert.deepEqual(after,before,'production-rendered counters and queue preview unchanged');
const operations = (label:string) => readFileSync(`output/performance-2026-10-09/dashboard-${label}-requests.jsonl`,'utf8')
  .trim().split('\n').map(line=>JSON.parse(line));
assert.equal(operations('before').length,23*6);
assert.equal(operations('after').length,23*5);
assert(!operations('after').some(op=>op.path.includes('/rpc/get_user_dashboard_stats')));
console.log('PASS: populated/empty stats, revision cooldown/priority, rendered dashboard parity, backend calls 6 → 5');
