import { createServer } from "node:http";

process.env.USE_LOCAL_DB = "false";
process.env.NEXT_PUBLIC_USE_LOCAL_DB = "false";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NODE_ENV = "production";
const { verifyStoredSettings } = await import("./fixtures/theme-server.mjs");
const { verifyThemes } = await import("./verify-themes.mjs");
const { default: next } = await import("next");
let handle;
const server = createServer((request, response) => handle(request, response));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const app = next({ dev: false, hostname: "127.0.0.1", port: server.address().port, httpServer: server });
try {
  await app.prepare();
  handle = app.getRequestHandler();
  await verifyThemes(`http://localhost:${server.address().port}`, true);
  verifyStoredSettings();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
  await app.close();
}
