import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readdir, access, writeFile } from "node:fs/promises";
import path from "node:path";

if (process.versions.node.split(".")[0] !== "22") throw new Error("Use Node 22 (see .nvmrc), then npm ci and npx playwright install chromium.");
const output = path.resolve("output/verification");
await mkdir(output, { recursive: true });
const env = { ...process.env, USE_LOCAL_DB: "false", NEXT_PUBLIC_USE_LOCAL_DB: "false",
  NEXT_PUBLIC_SUPABASE_URL: "https://auth-test.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "", GOOGLEDSA_VERIFY_BUILD: "true", CSP_ENFORCE: "false",
  CODEX_BROWSER_RUNTIME: path.resolve("node_modules"), SCORE_DB_TEST_RUNTIME: path.resolve("node_modules"),
  NEXT_TELEMETRY_DISABLED: "1" };
// A caller's private service configuration must not enter a verification child.
for (const key of Object.keys(env)) if (/^(SUPABASE_|DATABASE_URL|POSTGRES_)/.test(key)) env[key] = "";
delete env.NODE_ENV;
const results = [];
async function run(label, args, overrides = {}) {
  console.log(`\nChecking ${label}`);
  const log = [];
  const child = spawn(process.execPath, args, { env: { ...env, ...overrides }, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { log.push(chunk); process.stdout.write(chunk); });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  await writeFile(path.join(output, `${label}.log`), Buffer.concat(log));
  results.push({ check: label, passed: code === 0 });
  await writeFile(path.join(output, "result.json"), JSON.stringify({ node: process.version, results }, null, 2));
  return code === 0;
}
await run("security-scan", ["scripts/scan-secrets.mjs"]);
for (const name of (await readdir("scripts")).filter(name => /^test-.*\.ts$/.test(name)).sort()) {
  await run(name.replace(/\.ts$/, ""), ["node_modules/tsx/dist/cli.mjs", `scripts/${name}`]);
}
await run("lint", ["node_modules/eslint/bin/eslint.js", "app", "components", "lib", "scripts", "next.config.ts", "proxy.ts"]);
for (const name of ["test-security-db", "test-score-deletion-db", "test-migration-bundle", "test-revision-session-db"]) await run(name, [`scripts/${name}.mjs`]);
await run("dependency-audit", ["scripts/check-dependencies.mjs"]);
const sentinel = ".next-verification/cache/check-preserved";
await mkdir(path.dirname(sentinel), { recursive: true });
await writeFile(sentinel, "Builds must preserve the restored cache.\n");
const built = await run("build", ["node_modules/next/dist/bin/next", "build"]);
if (built) {
await access(sentinel);
await run("repeat-build", ["node_modules/next/dist/bin/next", "build"]);
await access(sentinel);
await run("startup-safety", ["scripts/test-startup-safety.mjs"]);
await run("auth-http", ["scripts/test-auth-http-runner.mjs"]);
await run("revision-session-http", ["scripts/test-revision-session-http.mjs"]);
await run("browser-enforce", ["scripts/test-bounded-reads-http.mjs"], { CSP_ENFORCE: "true" });
await run("browser-report-only", ["scripts/test-bounded-reads-http.mjs"], { CSP_ENFORCE: "false" });
await run("themes-http", ["scripts/test-themes-http-runner.mjs"]);
}
assert.ok(results.every(result => result.passed), "Checks failed; see output/verification/result.json and the named logs");
console.log("\nAll checks passed. Evidence: output/verification/result.json");
