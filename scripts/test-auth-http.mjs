import assert from "node:assert/strict";

const origin = process.env.AUTH_TEST_ORIGIN ?? "http://127.0.0.1:3102";
const key = "sb-auth-test-auth-token";
const encode = value => `base64-${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
function security(response) {
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.ok(response.headers.get("permissions-policy").includes("camera=()"));
  assert.ok(response.headers.get("content-security-policy").includes("frame-ancestors 'none'"));
}

const login = await fetch(`${origin}/login?error=auth`);
assert.equal(login.status, 200);
security(login);
assert.ok((await login.text()).includes("Google sign-in could not be completed. Please try again."));

const anonymous = await fetch(`${origin}/problems`, { redirect: "manual" });
assert.equal(anonymous.headers.get("location"), "/login");
security(anonymous);
const notFound = await fetch(`${origin}/missing-security-fixture`);
assert.equal(notFound.status, 404);
security(notFound);

for (const stale of [false, true]) {
  const cookie = [`${key}-code-verifier=${encode("fixture-verifier")}`];
  if (stale) {
    cookie.push(`${key}=${encode({ access_token: "stale", refresh_token: "revoked", expires_at: 1, user: { id: "old-user" } })}`);
    cookie.push(`${key}.9=stale-chunk`);
  }
  const response = await fetch(`${origin}/auth/callback?code=fixture-code&next=/problems`, {
    redirect: "manual", headers: { cookie: cookie.join("; ") },
  });
  assert.equal(response.status, 307);
  security(response);
  assert.equal(response.headers.get("location"), `${origin}/problems`);
  assert.ok(response.headers.get("cache-control").includes("no-store"));
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some(cookie => cookie.startsWith(`${key}-code-verifier=;`) && cookie.includes("Max-Age=0")));
  if (stale) assert.ok(cookies.some(cookie => cookie.startsWith(`${key}.9=;`) && cookie.includes("Max-Age=0")));
  const session = cookies.find(cookie => cookie.startsWith(`${key}=`) && !cookie.includes("Max-Age=0"));
  assert.ok(session);
  const protectedPage = await fetch(`${origin}/problems`, { redirect: "manual", headers: { cookie: session.split(";")[0] } });
  assert.equal(protectedPage.status, 200);
  assert.ok((await protectedPage.text()).includes("auth-fixture@example.com"));
  console.log(`PASS HTTP: ${stale ? "stale" : "empty"} session callback sends cookies; next protected page is authenticated`);
}

const expired = encode({ access_token: "expired-access-token", refresh_token: "fixture-refresh-token", expires_at: 1, user: { id: "fixture-user" } });
const refreshed = await fetch(`${origin}/problems`, { redirect: "manual", headers: { cookie: `${key}=${expired}` } });
assert.equal(refreshed.status, 200);
security(refreshed);
assert.ok(refreshed.headers.getSetCookie().some(cookie => cookie.startsWith(`${key}=`)));
assert.ok((await refreshed.text()).includes("auth-fixture@example.com"));
console.log("PASS HTTP: expired session refresh reaches both server-rendered page and browser cookies");

const failed = await fetch(`${origin}/auth/callback?code=invalid`, { redirect: "manual" });
assert.equal(failed.headers.get("location"), `${origin}/login?error=auth`);
console.log("PASS HTTP: anonymous pages stay protected and callback failure displays a login error");
