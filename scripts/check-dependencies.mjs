import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const npm = process.env.npm_execpath;
assert.ok(npm, "Run through npm run check so the active npm CLI is known");
await mkdir("output/verification", { recursive: true });
for (const production of [true, false]) {
  const result = spawnSync(process.execPath, [npm, "audit", "--json", ...(production ? ["--omit=dev"] : [])], { encoding: "utf8" });
  const audit = JSON.parse(result.stdout);
  assert.ok(audit.metadata && audit.vulnerabilities && !audit.error, "Dependency audit must reach the registry successfully");
  await writeFile(path.join("output/verification", production ? "production-audit.json" : "full-audit.json"), JSON.stringify(audit, null, 2));
  for (const [name, vulnerability] of Object.entries(audit.vulnerabilities)) {
    assert.ok(!production && vulnerability.isDirect !== undefined && vulnerability.via.every(via =>
      typeof via === "string" || via.url === "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm"), `Unreviewed advisory in ${name}`);
  }
  console.log(production ? "Production dependency audit is clear" : "Full audit contains only the documented development lint advisory (if still present)");
}
