import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { loadProblemsFromCsv } from '../../lib/problems-csv';
import { computeStatsFromProblems } from '../../lib/data';
import { getNextProblems } from '../../lib/recommendations/nextProblems';
import { selectRevisionQueue } from '../../lib/revision/selectRevisionQueue';
import type { ProblemWithProgress } from '../../lib/types';

function benchmark(fn: () => unknown) {
  for (let i = 0; i < 10; i++) fn();
  const samples = Array.from({ length: 100 }, () => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return { samples: samples.length, medianMs: +samples[50].toFixed(3), p95Ms: +samples[94].toFixed(3), maxMs: +samples[99].toFixed(3) };
}
const started = performance.now();
const catalog = loadProblemsFromCsv();
const firstCsvParseMs = performance.now() - started;
const problems: ProblemWithProgress[] = catalog.map(p => ({ ...p, user_problem: null, status: 'unsolved' }));
const json = JSON.stringify(problems);
const result = {
  measuredAt: new Date().toISOString(),
  context: 'Local CPU only; actual repository CSV, all-unsolved synthetic progress; warmed functions, 100 samples. Payload is JSON estimate, not RSC wire transfer.',
  catalogRows: catalog.length,
  firstCsvParseMs: +firstCsvParseMs.toFixed(3),
  fullCatalogProgressJsonBytes: Buffer.byteLength(json),
  fullCatalogProgressGzipBytes: gzipSync(json).length,
  csvParse: benchmark(loadProblemsFromCsv),
  dashboardStats: benchmark(() => computeStatsFromProblems(problems)),
  revisionQueue: benchmark(() => selectRevisionQueue(problems, { limit: 10 })),
  recommendations: benchmark(() => getNextProblems(problems, 5)),
};
writeFileSync('output/performance-2026-10-09/backend-cpu-results.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
