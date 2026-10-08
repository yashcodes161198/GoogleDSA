import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

const results = { measuredAt: new Date().toISOString(), samples: [], assets: {} };
const targets = [
  ['local-in-memory', 'http://127.0.0.1:3100', ['/dashboard', '/problems', '/revise', '/interview']],
  ['production-unauthenticated', 'https://google-dsa.vercel.app', ['/login', '/problems']],
];
for (const [environment, origin, paths] of targets) {
  for (const path of paths) {
    for (let iteration = 0; iteration < 7; iteration++) {
      const begin = performance.now();
      const response = await fetch(origin + path, { headers: { 'Accept-Encoding': 'identity' }, signal: AbortSignal.timeout(15000) });
      const headersMs = performance.now() - begin;
      const body = Buffer.from(await response.arrayBuffer());
      results.samples.push({ environment, path, iteration, status: response.status,
        finalPath: new URL(response.url).pathname, headersMs, totalMs: performance.now() - begin,
        bytes: body.length, estimatedGzipBytes: gzipSync(body).length,
        cache: response.headers.get('x-vercel-cache'), contentEncoding: response.headers.get('content-encoding') });
      if (environment === 'local-in-memory' && iteration === 6) {
        const html = body.toString();
        const scriptPaths = [...new Set([...html.matchAll(/<script[^>]*src="([^"?]+)[^"]*"/g)].map(m => m[1]))];
        const styles = [...new Set([...html.matchAll(/<link[^>]*href="([^"?]+\.css)[^"]*"/g)].map(m => m[1]))];
        const assets = [];
        for (const assetPath of [...scriptPaths, ...styles]) {
          const content = await readFile('.next/' + assetPath.replace('/_next/', ''));
          assets.push({ path: assetPath, rawBytes: content.length, estimatedGzipBytes: gzipSync(content).length });
        }
        results.assets[path] = { assets, scriptGzipBytes: assets.filter(a => a.path.endsWith('.js')).reduce((s,a)=>s+a.estimatedGzipBytes,0),
          cssGzipBytes: assets.filter(a => a.path.endsWith('.css')).reduce((s,a)=>s+a.estimatedGzipBytes,0),
          serializedProblemOccurrences: [...html.matchAll(/\\"leetcode_slug\\"/g)].length };
      }
    }
  }
}
await writeFile(new URL('./http-results.json', import.meta.url), JSON.stringify(results, null, 2));
const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
for (const [environment,,paths] of targets) for (const path of paths) {
  const samples = results.samples.filter(s => s.environment === environment && s.path === path);
  const warm = samples.slice(1);
  console.log(JSON.stringify({ environment, path, finalPath: samples.at(-1).finalPath,
    firstTotalMs: samples[0].totalMs, warmMedianHeadersMs: median(warm.map(s=>s.headersMs)),
    warmMedianTotalMs: median(warm.map(s=>s.totalMs)), warmMinMs: Math.min(...warm.map(s=>s.totalMs)),
    warmMaxMs: Math.max(...warm.map(s=>s.totalMs)), bytes: samples.at(-1).bytes,
    estimatedGzipBytes: samples.at(-1).estimatedGzipBytes,
    scriptGzipBytes: environment === 'local-in-memory' ? results.assets[path]?.scriptGzipBytes : undefined,
    cssGzipBytes: environment === 'local-in-memory' ? results.assets[path]?.cssGzipBytes : undefined }));
}
