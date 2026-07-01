import { rmSync } from "node:fs";

// Runs via the `prebuild` npm script before `next build`.
// Vercel restores the previous deployment's build cache into `.next` before
// `npm run build` runs. That cache can come from a radically different build
// (here: the old `proxy.ts` version) and break the new build in ways that don't
// reproduce locally. Wiping `.next` here forces a clean build every time.
for (const dir of [".next", "out"]) {
  rmSync(dir, { recursive: true, force: true });
}
