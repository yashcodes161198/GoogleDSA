import "next/dist/server/node-environment";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { signInWithGoogle } from "../lib/supabase/oauth";
import { GET } from "../app/auth/callback/route";
import { proxy, config } from "../proxy";

const supabaseUrl = "https://auth-test.supabase.co";
const storageKey = "sb-auth-test-auth-token";
const user = { id: "test-user", email: "test@example.com", aud: "authenticated" };
const session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_at: Math.floor(Date.now() / 1000) - 3600,
  expires_in: 3600,
  token_type: "bearer",
  user,
};

function cookieJar(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getAll: () => [...values].map(([name, value]) => ({ name, value })),
    setAll: (cookies: { name: string; value: string; options: { maxAge?: number } }[]) => {
      cookies.forEach(({ name, value, options }) => {
        if (options.maxAge === 0) values.delete(name);
        else values.set(name, value);
      });
    },
  };
}

async function reproduceStartupRace(waitForInitialization: boolean) {
  const jar = cookieJar({ [storageKey]: JSON.stringify(session) });
  let releaseRefresh!: () => void;
  let refreshStarted!: () => void;
  const started = new Promise<void>(resolve => { refreshStarted = resolve; });
  const release = new Promise<void>(resolve => { releaseRefresh = resolve; });
  const client = createBrowserClient(supabaseUrl, "test-anon-key", {
    isSingleton: false,
    cookieEncoding: "raw",
    cookies: jar,
    auth: { autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: async (input) => {
      assert.equal(new URL(String(input)).searchParams.get("grant_type"), "refresh_token");
      refreshStarted();
      await release;
      return new Response(JSON.stringify({ code: "refresh_token_not_found", message: "Expired session" }), { status: 400 });
    } },
  });

  await started;
  let url: string;
  if (waitForInitialization) {
    const signIn = signInWithGoogle(client, "https://app.example/auth/callback");
    releaseRefresh();
    ({ data: { url } } = await signIn);
  } else {
    ({ data: { url } } = await client.auth.signInWithOAuth({ provider: "google", options: { skipBrowserRedirect: true } }));
    assert.ok(jar.values.has(`${storageKey}-code-verifier`), "OAuth initially writes its verifier");
    releaseRefresh();
    await client.auth.initialize();
  }
  await client.auth.stopAutoRefresh();

  let verifierAccepted = false;
  const server = createServerClient(supabaseUrl, "test-anon-key", {
    cookieEncoding: "raw",
    cookies: jar,
    global: { fetch: async (_input, init) => {
      const { code_verifier } = JSON.parse(String(init?.body));
      const challenge = createHash("sha256").update(code_verifier ?? "").digest("base64url");
      verifierAccepted = Boolean(code_verifier) && challenge === new URL(url).searchParams.get("code_challenge");
      return new Response(JSON.stringify(verifierAccepted
        ? { ...session, expires_at: Math.floor(Date.now() / 1000) + 3600 }
        : { code: "bad_code_verifier", message: "Missing code verifier" }), { status: verifierAccepted ? 200 : 400 });
    } },
  });
  const result = await server.auth.exchangeCodeForSession("test-oauth-code");
  assert.equal(result.error === null, waitForInitialization);
  assert.equal(verifierAccepted, waitForInitialization);
  console.log(waitForInitialization ? "PASS: waiting for startup preserves PKCE through the callback" : "REPRODUCED: expired-session cleanup deletes the new PKCE verifier; callback fails");
}

function encoded(value: unknown) {
  return `base64-${Buffer.from(JSON.stringify(value)).toString("base64url")}`;
}

async function testCallback() {
  const originalFetch = globalThis.fetch;
  try {
    for (const hasExpiredSession of [false, true]) {
      const jar = cookieJar(hasExpiredSession ? { [storageKey]: encoded(session) } : {});
      const client = createBrowserClient(supabaseUrl, "test-anon-key", {
        isSingleton: false,
        cookies: jar,
        auth: { autoRefreshToken: true, detectSessionInUrl: false },
        global: { fetch: async () => Response.json({ code: "refresh_token_not_found", message: "Revoked previous session" }, { status: 400 }) },
      });
      const { data: { url } } = await signInWithGoogle(client, "https://app.example/auth/callback");
      await client.auth.getSession();
      await client.auth.dispose();
      if (hasExpiredSession) jar.values.set(storageKey, encoded(session));
      let exchanges = 0;
      globalThis.fetch = async (input, init) => {
        assert.equal(new URL(String(input)).searchParams.get("grant_type"), "pkce", "callback must not refresh the previous session before exchanging the code");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.auth_code, "first-code");
        assert.equal(createHash("sha256").update(body.code_verifier).digest("base64url"), new URL(url).searchParams.get("code_challenge"));
        exchanges++;
        return Response.json({ ...session, expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { ...user, user_metadata: { avatar: "x".repeat(5000) } } });
      };
      const request = new NextRequest("https://app.example/auth/callback?code=first-code&next=/problems", {
        headers: { cookie: jar.getAll().map(({ name, value }) => `${name}=${value}`).join("; ") },
      });
      const response = await GET(request);
      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), "https://app.example/problems");
      assert.equal(exchanges, 1);
      assert.ok(response.headers.get("cache-control")?.includes("no-store"));
      assert.ok(response.cookies.get(`${storageKey}.0`)?.value, "redirect carries chunked session cookies");
      assert.ok(response.cookies.get(`${storageKey}.1`)?.value);
      assert.equal(response.cookies.get(`${storageKey}-code-verifier`)?.maxAge, 0);

      jar.setAll(response.cookies.getAll().map(cookie => ({ name: cookie.name, value: cookie.value, options: cookie })));
      globalThis.fetch = async (input, init) => {
        assert.equal(new URL(String(input)).pathname, "/auth/v1/user");
        assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-access-token");
        return Response.json(user);
      };
      const server = createServerClient(supabaseUrl, "test-anon-key", { cookies: jar });
      assert.equal((await server.auth.getUser()).data.user?.id, user.id, "next request recognizes the signed-in user");
      console.log(`PASS: ${hasExpiredSession ? "expired" : "empty/incognito"} session signs in with one callback and survives the next request`);
    }

    let exchanges = 0;
    globalThis.fetch = async () => {
      exchanges++;
      return Response.json({ code: "bad_code_verifier", message: "Invalid verifier" }, { status: 400 });
    };
    for (const query of ["", "?error=access_denied", "?code=invalid-code"]) {
      const response = await GET(new NextRequest(`https://app.example/auth/callback${query}`));
      assert.equal(response.headers.get("location"), "https://app.example/login?error=auth");
      assert.ok(response.headers.get("cache-control")?.includes("no-store"));
      assert.equal(response.cookies.getAll().filter(cookie => cookie.value).length, 0);
    }
    assert.equal(exchanges, 0, "missing code, missing verifier and provider rejection never call the token endpoint");
    const rejected = await GET(new NextRequest("https://app.example/auth/callback?code=reused-code", {
      headers: { cookie: `${storageKey}-code-verifier=${encoded("test-verifier")}` },
    }));
    assert.equal(rejected.headers.get("location"), "https://app.example/login?error=auth");
    assert.equal(exchanges, 1);

    globalThis.fetch = async () => Response.json({ ...session, expires_at: Math.floor(Date.now() / 1000) + 3600 });
    for (const next of ["https://other.example", "//other.example", "/\\other.example"]) {
      const response = await GET(new NextRequest(`https://app.example/auth/callback?code=valid&next=${encodeURIComponent(next)}`, {
        headers: { cookie: `${storageKey}-code-verifier=${encoded("test-verifier")}` },
      }));
      assert.equal(response.headers.get("location"), "https://app.example/dashboard");
    }
    console.log("PASS: callback failures return to login with an error; redirects stay on the app origin");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testSessionRefresh() {
  const originalFetch = globalThis.fetch;
  try {
    let refreshes = 0;
    globalThis.fetch = async (input, init) => {
      assert.equal(new URL(String(input)).searchParams.get("grant_type"), "refresh_token");
      assert.equal(JSON.parse(String(init?.body)).refresh_token, session.refresh_token);
      refreshes++;
      return Response.json({ ...session, access_token: "refreshed-access-token", refresh_token: "rotated-refresh-token", expires_at: Math.floor(Date.now() / 1000) + 3600 });
    };
    const request = new NextRequest("https://app.example/dashboard", { headers: { cookie: `${storageKey}=${encoded(session)}` } });
    const response = await proxy(request);
    assert.equal(refreshes, 1);
    assert.ok(response.headers.get("cache-control")?.includes("no-store"));
    const updated = response.cookies.get(storageKey)?.value;
    assert.ok(updated, "refreshed session is sent to the browser");
    assert.equal(request.cookies.get(storageKey)?.value, updated, "server rendering sees the refreshed session immediately");
    assert.ok(response.headers.get("x-middleware-request-cookie")?.includes(updated), "fresh cookies are forwarded to the route");
    const refreshedSession = JSON.parse(Buffer.from(updated.slice(7), "base64url").toString());
    assert.equal(refreshedSession.refresh_token, "rotated-refresh-token");

    globalThis.fetch = async () => { throw new Error("Current/empty sessions must not call Auth in proxy"); };
    await proxy(new NextRequest("https://app.example/dashboard", { headers: { cookie: `${storageKey}=${updated}` } }));
    await proxy(new NextRequest("https://app.example/login"));

    globalThis.fetch = async () => Response.json({ code: "refresh_token_not_found", message: "Revoked session" }, { status: 400 });
    const expiredRequest = new NextRequest("https://app.example/login", { headers: { cookie: `${storageKey}=${encoded(session)}` } });
    const cleared = await proxy(expiredRequest);
    assert.equal(cleared.cookies.get(storageKey)?.maxAge, 0);
    assert.equal(expiredRequest.cookies.get(storageKey)?.value, "");
    assert.equal(cleared.headers.get("location"), null, "proxy leaves authorization to the protected route");
    console.log("PASS: expired tokens refresh for browser and server; revoked cookies clear; current/empty sessions make zero Auth requests in proxy");
  } finally {
    globalThis.fetch = originalFetch;
  }
  for (const url of ["/auth/callback?code=one-use-code", "/_next/static/chunk.js", "/_next/image", "/favicon.ico", "/logo.png"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), false, `${url} bypasses proxy`);
  }
  for (const url of ["/", "/login", "/dashboard", "/api/library", "/problems", "/revise"]) {
    assert.equal(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url }), true, `${url} refreshes sessions`);
  }
  process.env.USE_LOCAL_DB = "true";
  const localResponse = await proxy(new NextRequest("https://app.example/dashboard"));
  assert.equal(localResponse.cookies.getAll().length, 0);
  process.env.USE_LOCAL_DB = "false";
  console.log("PASS: OAuth callback/assets bypass proxy; local mode bypasses Supabase");
}

async function main() {
  const previous = { ...process.env };
  process.env.USE_LOCAL_DB = "false";
  process.env.NEXT_PUBLIC_USE_LOCAL_DB = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  try {
    await reproduceStartupRace(false);
    await reproduceStartupRace(true);
    await testCallback();
    await testSessionRefresh();
  } finally {
    for (const key of ["USE_LOCAL_DB", "NEXT_PUBLIC_USE_LOCAL_DB", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
