import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const { scripts } = JSON.parse(await readFile("package.json", "utf8"));
assert.equal(scripts.prestart, undefined);
assert.equal(scripts.predev, undefined);
assert.equal(scripts.prebuild, undefined);
const listener = createServer((_request, response) => response.end("original listener is alive"));
await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
try {
  for (const mode of ["start", "dev"]) {
    assert.equal(scripts[mode], `next ${mode}`);
    const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", mode, "--hostname", "127.0.0.1", "--port", String(port)],
      { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
    const timeout = setTimeout(() => child.kill(), 20000);
    let code;
    try { code = await new Promise((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); }); }
    finally { clearTimeout(timeout); }
    assert.notEqual(code, 0);
    assert.match(output, /EADDRINUSE|address already in use/i);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(), "original listener is alive");
  }
  console.log("Production/development port conflicts leave the existing listener alive");
} finally { await new Promise(resolve => listener.close(resolve)); }
