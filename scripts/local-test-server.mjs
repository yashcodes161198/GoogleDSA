// Explicit loopback-only launcher for production-build fixtures using local memory.
import { createServer } from "node:http";
process.env.USE_LOCAL_DB = "true";
process.env.GOOGLEDSA_LOCAL_TEST = "true";
process.env.GOOGLEDSA_BIND_HOST = "127.0.0.1";
process.env.NODE_ENV = "production";
const port = Number(process.env.PORT ?? 3123);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
const { default: next } = await import("next");
const app = next({ dev:false, hostname:"127.0.0.1", port });
await app.prepare();
const server = createServer(app.getRequestHandler());
server.listen(port,"127.0.0.1",()=>console.log(`Loopback fixture ready on http://127.0.0.1:${port}`));
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>server.close(async()=>{ await app.close(); process.exit(0); }));
