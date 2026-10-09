// Test-only preload for the HTTP checks. Never import this from application code.
const user = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "auth-fixture@example.com",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
};

const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return fetchOriginal(input, init);
  if (url.origin !== "https://auth-test.supabase.co") throw new Error("Auth fixture blocks external requests");

  if (url.pathname === "/auth/v1/token") {
    const body = JSON.parse(String(init?.body));
    const grant = url.searchParams.get("grant_type");
    const valid = grant === "pkce"
      ? body.auth_code === "fixture-code" && body.code_verifier === "fixture-verifier"
      : grant === "refresh_token" && body.refresh_token === "fixture-refresh-token";
    if (!valid) return Response.json({ error_code: "refresh_token_not_found", msg: "Invalid test credentials" }, { status: 400 });
    return Response.json({
      access_token: "fixture-access-token",
      refresh_token: "fixture-rotated-refresh-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: "bearer",
      user,
    });
  }
  if (url.pathname === "/auth/v1/user") return Response.json(user);
  if (url.pathname.startsWith("/rest/v1/")) return Response.json([]);
  throw new Error(`Unhandled auth fixture endpoint: ${url.pathname}`);
};
