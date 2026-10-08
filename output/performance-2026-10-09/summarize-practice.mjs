import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = name => readFileSync(new URL(name,import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
const stats = values => {
  const sorted = [...values].sort((a,b)=>a-b);
  return { median: (sorted[(sorted.length-1)>>1]+sorted[sorted.length>>1])/2, min:sorted[0], max:sorted.at(-1) };
};
const result = {};
for (const phase of ['before','after']) {
  const http = read(`practice-${phase}-http.jsonl`);
  const backend = read(`practice-${phase}-backend.jsonl`);
  const nav = http.filter(p => p.rsc && !p.prefetch && p.method==='GET' && /^\/(problems|revise)\?/.test(p.path)).slice(0,20);
  assert.equal(nav.length,20);
  assert(nav.every(p=>p.status===200));
  const calls = backend.filter(call => nav.some(p=>call.at>=p.at-p.totalMs && call.at<=p.at));
  result[phase] = {
    samples:nav.length, totalMs:stats(nav.map(p=>p.totalMs)), responseBytes:stats(nav.map(p=>p.bytes)),
    totalResponseBytes:nav.reduce((n,p)=>n+p.bytes,0), backendFetches:calls.length,
    byRoute:Object.fromEntries(['problems','revise'].map(route=>{
      const rows=nav.filter(p=>p.path.startsWith('/'+route+'?'));
      return [route,{ totalMs:stats(rows.map(p=>p.totalMs)), responseBytes:stats(rows.map(p=>p.bytes)) }];
    })),
    firstDocument:http.find(p=>p.path==='/problems' && !p.rsc && p.method==='GET'),
  };
}
assert.equal(result.before.backendFetches,60);
assert.equal(result.after.backendFetches,0);
assert(result.after.totalMs.max < result.before.totalMs.min,'improvement exceeds observed noise');
writeFileSync(new URL('practice-comparison.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
