import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Explicit recovery command; ordinary builds retain their cache.
const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
for (const dir of [".next", ".next-verification", ".next-ui-preview", "out"]) {
  const target = path.resolve(root, dir);
  if (path.dirname(target) !== root) throw new Error("Clean target must stay inside the project");
  rmSync(target, { recursive: true, force: true });
}
