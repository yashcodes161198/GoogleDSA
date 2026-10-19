import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const origin = 'http://127.0.0.1:3123';
const results = { environment: 'loopback production build, in-memory database, Node 20.15.0', samples: [], summary: [] };
for (const path of ['/dashboard', '/problems', '/revise', '/interview', '/leaderboard', '/settings', '/api/library']) {
  let body;
  let headers;
  for (let i = 0; i < 11; i++) {
    const start = performance.now();
    const response = await fetch(origin + path, { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(15000) });
    body = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    headers = Object.fromEntries(response.headers);
    results.samples.push({ path, iteration: i, ms: performance.now() - start, bytes: body.length });
  }
  const times = results.samples.filter(s => s.path === path && s.iteration > 0).map(s => s.ms).sort((a,b) => a-b);
  const scripts = [...new Set([...body.toString().matchAll(/<script[^>]*src="([^"?]+)[^"]*"/g)].map(m => m[1]))];
  let jsGzip = 0;
  for (const script of scripts) {
    assert.ok(script.startsWith('/_next/'));
    jsGzip += gzipSync(await readFile('.next/' + script.replace('/_next/', ''))).length;
  }
  const entry = { path, medianMs: (times[4]+times[5])/2, minMs: times[0], maxMs: times[9], bytes: body.length, estimatedGzipBytes: gzipSync(body).length, initialJsGzipBytes: jsGzip,
    headers: Object.fromEntries(['content-security-policy','x-frame-options','x-content-type-options','referrer-policy','permissions-policy','cache-control'].map(k => [k, headers[k] ?? null])) };
  if (path === '/api/library') entry.problems = JSON.parse(body).problems.length;
  results.summary.push(entry);
}
await writeFile(new URL('./http-results.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
