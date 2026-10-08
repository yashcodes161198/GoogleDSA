import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const name = process.argv[2] ?? 'prod-before-brave';
if (!/^prod-(before|after)-brave$/.test(name)) throw new Error('Use prod-before-brave or prod-after-brave');
const data = JSON.parse(readFileSync(new URL(name+'.json',import.meta.url)));
const summarize = values => {
  const v=[...values].sort((a,b)=>a-b);
  return { n:v.length, medianMs:(v[(v.length-1)>>1]+v[v.length>>1])/2, minMs:v[0], maxMs:v.at(-1) };
};
assert.equal(data.navigation.length,20);
assert.equal(data.favoriteTest.finalRestored,true);
assert.equal(data.smoke.restoredRows,50);
const summary={
  phase:data.phase,method:data.method,
  navigation:Object.fromEntries(['problems','revise'].map(route=>[route,summarize(data.navigation.filter(p=>p.to===route).map(p=>p.elapsedMs))])),
  reloads:Object.fromEntries(['problems','revise'].map(route=>[route,summarize(data.reloads.filter(p=>p.to===route).map(p=>p.elapsedMs))])),
  feedback:summarize(data.saves.map(p=>p.feedbackMs)),
  settled:summarize(data.saves.filter(p=>p.transitionSettledMs!==null).map(p=>p.transitionSettledMs)),
  loadedWaitControl:summarize(data.loadedWaitOverheadMs),
  samePageClickControl:summarize(data.samePageClickControls.map(p=>p.totalMs)),
};
writeFileSync(new URL(name+'-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
