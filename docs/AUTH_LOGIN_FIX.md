# Google sign-in investigation — 9 October 2026

Branch: `codex/fix-google-first-login`.

## Finding

The expired-session failure is reproducible with the installed Supabase SDK. Creating the browser client starts asynchronous session recovery. `signInWithOAuth()` does not wait for that recovery before writing a new PKCE verifier. If the old refresh token is rejected afterwards, session cleanup deletes the new verifier. The OAuth callback then fails because it cannot exchange the authorization code without that verifier. A second attempt can succeed after the old session has been removed.

The regression test holds the old refresh response until Google sign-in has written its verifier, then rejects the refresh. It verifies that the original sequence loses the verifier and fails the callback. Running the same sequence through the new sign-in helper preserves the verifier and completes the exchange.

Two related server issues were found:

- The server client silently discards cookie writes during Server Component rendering. Without a proxy, a refresh can rotate tokens without delivering the new cookies to the browser.
- The callback's server client subscribes to auth events, which can trigger an initial session read and refresh an old cookie concurrently with the new code exchange. An expired-cookie callback test exposed that additional refresh request.

## Changes

- Finish browser auth initialization before starting Google OAuth. Keep the button disabled while the browser redirects, and show startup failures.
- Refresh or clear session cookies in Next.js Proxy before rendering. Forward changes both to the current server request and to the browser response. Proxy only manages session storage; protected pages/actions still verify identity with `getUser()`. Current and empty sessions incur no extra Auth request in Proxy.
- Isolate the callback from previous session values while retaining cookie names so stale chunks can be removed. Write all cookies and Supabase cache headers directly onto the redirect response. Callback requests bypass Proxy.
- Show a useful login error when the exchange fails, and log only the SDK error code/status. Callback redirects stay on the app's origin.

## Production observations

On `https://google-dsa.vercel.app`, two Google accounts were tested in Chrome. The initial login page had no recognized app session. The first account returned directly to the dashboard; reloading preserved the session. After signing out of that account, the second account followed account selection → Google Continue → dashboard successfully on the first attempt. No practice data was changed.

The reported double-login behavior was **not reproduced in those live attempts**. The expired-session race was reproduced deterministically in the local SDK test. Empty/incognito cookie state was tested with fixtures, not a live private browser window. This branch has not been deployed, so live confirmation of the fix remains a post-deployment check.

## Verification

- `test:auth`: original race reproduced; fixed helper passes; empty and expired sessions complete one callback; chunked cookies reach the redirect and authenticate the next request; missing/rejected codes fail safely; expired sessions refresh; revoked cookies clear; current/empty sessions add no Proxy Auth request; callback/assets and local mode bypass refresh appropriately.
- Production Next.js build with auth enabled: compilation and TypeScript checks passed.
- `test:auth:http`: actual HTTP requests through that production build passed for empty and stale callback cookies, removal of stale chunks, the next protected page, session refresh cookies, anonymous access denial, and login error rendering.
- ESLint passed for changed application and test files.

The HTTP fixture replaces only the synthetic Supabase origin and blocks other external backend requests. It uses no production credentials or data. Its runner binds to loopback on a temporary port and shuts down after testing. Never import the fixture from application code.

To repeat the HTTP check, build with auth enabled and the synthetic public configuration first. For PowerShell, in a temporary shell:

```powershell
$env:USE_LOCAL_DB='false'
$env:NEXT_PUBLIC_USE_LOCAL_DB='false'
$env:NEXT_PUBLIC_SUPABASE_URL='https://auth-test.supabase.co'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='test-anon-key'
npm run build
npm run test:auth:http
```

Use Node 22 as configured by the project, or a supported newer runtime. These checks were run with the bundled Node 24 runtime because the system Node 20.15 is below Next.js's supported minimum.

After deployment, check a fresh private browser login, login with an expired/revoked app session, a page reload, and reopening the browser. Each successful OAuth attempt should land on the dashboard once and retain its session.

References: [Supabase SSR setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase SSR cookie/cache behavior](https://supabase.com/docs/guides/auth/server-side/advanced-guide). Next.js API usage was checked against the installed `node_modules/next/dist/docs/` guides.
