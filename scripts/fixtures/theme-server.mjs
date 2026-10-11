// Synthetic account backend for the theme integration check. Never import from app code.
const users = new Map(["one", "two"].map((id) => [`theme-${id}`, {
  id: `theme-user-${id}`, email: `${id}@theme.test`, aud: "authenticated",
  app_metadata: {}, user_metadata: { existing_setting: "preserve" },
}]));
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return originalFetch(input, init);
  if (url.origin !== "https://auth-test.supabase.co") throw new Error("Theme fixture blocks external requests");
  if (url.pathname === "/auth/v1/user") {
    const headers = new Headers(init?.headers ?? input.headers);
    const user = users.get(headers.get("authorization")?.replace("Bearer ", ""));
    if (!user) return Response.json({ msg: "Invalid fixture token" }, { status: 401 });
    if ((init?.method ?? input.method) === "PUT") {
      const body = JSON.parse(init.body);
      Object.assign(user.user_metadata, body.data);
    }
    return Response.json(user);
  }
  if (url.pathname.startsWith("/rest/v1/")) return Response.json([]);
  throw new Error(`Unhandled theme fixture endpoint: ${url.pathname}`);
};

export function verifyStoredSettings() {
  const one = users.get("theme-one").user_metadata;
  const two = users.get("theme-two").user_metadata;
  if (one.existing_setting !== "preserve" || two.existing_setting !== "preserve") throw new Error("Unrelated metadata changed");
  if (two.appearance) throw new Error("Another user's settings were changed");
}
