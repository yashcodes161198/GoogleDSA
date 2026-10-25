import { createServer } from "node:http";

process.env.USE_LOCAL_DB = "true";
process.env.GOOGLEDSA_LOCAL_TEST = "true";
process.env.GOOGLEDSA_BIND_HOST = "127.0.0.1";
process.env.NODE_ENV = "production";
const { default: next } = await import("next");
let handle;
const server = createServer((request, response) => handle(request, response));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const app = next({ dev: false, hostname: "127.0.0.1", port: server.address().port, httpServer: server });
try {
  await app.prepare();
  handle = app.getRequestHandler();
  process.env.INTERIOR_TEST_URL = `http://127.0.0.1:${server.address().port}`;
  await import("./verify-interior-ui.mjs");
} finally {
  await new Promise(resolve => server.close(resolve));
  await app.close();
}
