import { writeFileSync } from 'node:fs';
import { loadProblemsFromCsv } from '../../lib/problems-csv';

const now = new Date();
const day = 86400000;
const user = { id: '00000000-0000-0000-0000-000000000099', aud: 'authenticated',
  role: 'authenticated', email: 'fixture@example.invalid', app_metadata: { provider: 'email' },
  user_metadata: {}, created_at: new Date(now.getTime() - 30 * day).toISOString() };
const problems = loadProblemsFromCsv().sort((a,b) => b.frequency - a.frequency);
const progress = problems.flatMap((problem, index) => index % 3 ? [] : [{
  user_id: user.id, problem_id: problem.id, status: 'solved', notes: null,
  solved_at: new Date(now.getTime() - (index < 9 || index % 9 ? 7 * day : day)).toISOString(),
  ease_factor: 2.5, interval_days: 1, repetitions: 1,
  next_review_at: new Date(now.getTime() + (index % 2 ? day : -day)).toISOString(),
  last_reviewed_at: null, revision_count: index % 5,
  last_revised_at: index < 9 ? now.toISOString() : null,
  last_solve_seconds: 120, best_solve_seconds: 90, is_favorite: index % 2 === 0,
}]);
// Independent aggregate fixture, following migration 002's joins/grouping.
const byId = new Map(progress.map(row => [row.problem_id, row]));
const byDifficulty = Object.fromEntries(['EASY','MEDIUM','HARD'].map(difficulty => [difficulty, {
  total: problems.filter(p => p.difficulty === difficulty).length,
  solved: problems.filter(p => p.difficulty === difficulty && byId.has(p.id)).length,
}]));
const topics = [...new Set(problems.flatMap(p => p.topics.length ? p.topics : ['General']))];
const topicCoverage = topics.map(topic => {
  const matching = problems.filter(p => (p.topics.length ? p.topics : ['General']).includes(topic));
  return { topic, total: matching.length, solved: matching.filter(p => byId.has(p.id)).length };
}).sort((a,b) => a.solved / a.total - b.solved / b.total).slice(0,12);
const stats = { total: problems.length, solved: progress.length, attempted: 0,
  unsolved: problems.length - progress.length,
  reviewsDue: progress.filter(p => new Date(p.next_review_at) <= now).length,
  byDifficulty, topicCoverage };
writeFileSync('output/performance-2026-10-09/dashboard-fixture.json', JSON.stringify({
  generatedAt: now.toISOString(), user, problems, progress, stats,
}));
console.log({ questions: problems.length, solved: progress.length,
  revisedToday: progress.filter(p=>p.last_revised_at).length, reviewsDue: stats.reviewsDue });
