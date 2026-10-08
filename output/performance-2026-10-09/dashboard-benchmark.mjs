import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { performance } from 'node:perf_hooks';

const label = process.argv[2];
if (!['before','after'].includes(label)) throw new Error('Specify before or after');
const env = parse(readFileSync('.env'));
const fixture = JSON.parse(readFileSync(new URL('./dashboard-fixture.json', import.meta.url)));
const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const expires = Math.floor(Date.now()/1000) + 3600;
const session = { access_token: encode({alg:'HS256',typ:'JWT'}) + '.' +
  encode({sub:fixture.user.id,aud:'authenticated',role:'authenticated',exp:expires}) + '.fixture-signature',
  refresh_token: 'fixture-only', token_type:'bearer', expires_in:3600, expires_at:expires, user:fixture.user };
const cookie = 'sb-' + project + '-auth-token=base64-' + encode(session);
if (process.env.PERF_EXPECT_PROGRESS_ERROR === 'true') {
  const response = await fetch('http://127.0.0.1:3100/dashboard', { headers: {cookie}, signal:AbortSignal.timeout(15000) });
  const html = await response.text();
  if (html.includes('<dt>Problems solved</dt>') || !html.includes('digest')) {
    throw new Error('Failed progress read did not reach the Next error boundary');
  }
  console.log('PASS: failed progress fetch surfaces an error; no zero-progress dashboard rendered');
  process.exit(0);
}
const samples = [];
let finalHtml = '';
for (let i = 0; i < 23; i++) {
  const start = performance.now();
  const response = await fetch('http://127.0.0.1:3100/dashboard', {
    headers:{cookie,'Accept-Encoding':'identity'}, redirect:'manual', signal:AbortSignal.timeout(15000),
  });
  const html = await response.text();
  if (response.status !== 200 || !html.includes('Daily practice') || !html.includes('fixture@example.invalid')) {
    throw new Error('Fixture dashboard did not render: ' + response.status);
  }
  samples.push(performance.now()-start);
  finalHtml = html;
}
const warm = samples.slice(3).sort((a,b)=>a-b);
const summary = { label, context:'Production Next server with synthetic authenticated Supabase transport; 100ms per backend fetch; 3 warmups + 20 samples; not live production latency',
  medianMs:(warm[9]+warm[10])/2, minMs:warm[0], maxMs:warm.at(-1), p95Ms:warm[18], samples };
// Normalize rendered sections; ignore RSC IDs, scripts and metadata.
const sections = Object.fromEntries(['study-summary','queue-preview'].map(className => {
  const tag = className === 'study-summary' ? 'dl' : 'ol';
  const section = finalHtml.match(new RegExp('<'+tag+' class="'+className+'">([\\s\\S]*?)</'+tag+'>'))?.[1];
  if (!section) throw new Error('Missing populated dashboard section: ' + className);
  return [className,section];
}));
writeFileSync(new URL('./dashboard-'+label+'.json',import.meta.url),JSON.stringify(summary,null,2));
writeFileSync(new URL('./dashboard-'+label+'-sections.json',import.meta.url),JSON.stringify(sections,null,2));
console.log(JSON.stringify({...summary,samples:summary.samples.length},null,2));
