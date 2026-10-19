import assert from "node:assert/strict";
import { contentSecurityPolicy, securityHeaders } from "../lib/security-headers";

const policy = contentSecurityPolicy("fixture-nonce", "https://example.supabase.co/sensitive?token=private", false);
assert.ok(policy.includes("'nonce-fixture-nonce' 'strict-dynamic'"));
assert.ok(policy.includes("connect-src 'self' https://example.supabase.co wss://example.supabase.co"));
assert.ok(policy.includes("img-src 'self' https://example.supabase.co blob: data:"));
assert.ok(policy.includes("style-src 'self' 'unsafe-inline'"));
for (const forbidden of ["unsafe-eval", "sensitive", "token", "private", "report-uri", "report-to", "report-sample"]) {
  assert.ok(!policy.includes(forbidden), forbidden);
}
assert.ok(contentSecurityPolicy("development", "http://localhost:54321", true).includes("'unsafe-eval'"));
assert.equal(securityHeaders.find(header => header.key === "X-Frame-Options")?.value, "DENY");
console.log("Security policy passed: scoped origins/nonces, dev-only eval, theme/blob support, no report telemetry or URL credentials");
