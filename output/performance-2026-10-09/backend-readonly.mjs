import dotenv from 'dotenv';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';

dotenv.config({ path: '.env', quiet: true });
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const out = {
  measuredAt: new Date().toISOString(),
  context: 'Local machine to Supabase; anonymous only, no user cookies, no service-role usage. These timings do not measure authenticated queries or Vercel-to-Supabase latency.',
  localModeEnabled: process.env.USE_LOCAL_DB === 'true' || process.env.NEXT_PUBLIC_USE_LOCAL_DB === 'true',
  samples: [],
};
if (base && anon) {
  for (const [name, path] of [
    ['auth_health', '/auth/v1/health'],
    ['catalog_anon_rls', '/rest/v1/problems?select=id,title,difficulty&limit=1'],
  ]) {
    for (let sample = 1; sample <= 5; sample++) {
      const start = performance.now();
      try {
        const res = await fetch(new URL(path, base), {
          headers: { apikey: anon, Authorization: `Bearer ${anon}` },
          signal: AbortSignal.timeout(15000),
        });
        const headersMs = performance.now() - start;
        const body = await res.text();
        let rows;
        try { const json = JSON.parse(body); if (Array.isArray(json)) rows = json.length; } catch {}
        out.samples.push({ name, sample, status: res.status, headersMs: +headersMs.toFixed(1), totalMs: +(performance.now() - start).toFixed(1), responseBytes: Buffer.byteLength(body), ...(rows !== undefined ? { rows } : {}) });
      } catch (e) {
        out.samples.push({ name, sample, totalMs: +(performance.now() - start).toFixed(1), errorType: e.name });
      }
    }
  }
}
writeFileSync('output/performance-2026-10-09/backend-readonly-results.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
