import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const deferredFingerprint = "ef3bbd1f91adc2104f6921ecb92d3ea2170f4b76dc52241d55d616ad782f3e63";

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).split("\0").filter(Boolean);
const findings = [];
let deferred = 0;
for (const file of new Set(files)) {
  let bytes;
  try { bytes = await readFile(file); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
  if (bytes.includes(0)) continue;
  const source = bytes.toString("utf8");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)) findings.push(`${file}: private key`);
  for (const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1], "base64url").toString()).role !== "service_role") continue;
      if (file === ".env.local.example" && createHash("sha256").update(match[0]).digest("hex") === deferredFingerprint) { deferred++; continue; }
      findings.push(`${file}: privileged JWT`);
    } catch { /* Non-JWT source text. */ }
  }
  if (/\b(?:sb_secret_|sk_live_)[A-Za-z0-9_-]{20,}/.test(source)) findings.push(`${file}: service secret`);
}
assert.deepEqual(findings, [], "Secret scan found credential material (values redacted)");
console.log(`Secret scan passed; ${deferred} existing example credential(s) remain explicitly deferred under S01. Rotation is excluded by the user.`);
