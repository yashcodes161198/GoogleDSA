import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.CODEX_BROWSER_RUNTIME, "package.json"));
const { chromium } = require("playwright");
const base = process.env.THEME_PREVIEW_URL || "http://localhost:3101";
const browser = await chromium.launch({ headless: true });
const results = [];
let current;
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}/settings`);
    await page.getByRole("heading", { name: "Appearance", exact: true }).waitFor();
    for (const kind of ["light", "dark"]) {
      const mode = page.locator(`input[name="theme-mode"][value="${kind}"]`);
      await mode.check();
      await page.waitForFunction(() => !document.querySelector('input[name="theme-mode"]').disabled);
      const picker = page.locator("details").filter({ has: page.locator(`input[name="${kind}-theme"]`) });
      if (!(await picker.evaluate((el) => el.open))) await picker.locator("summary").click();
      const labels = picker.locator("label");
      for (let i = 0; i < await labels.count(); i++) {
        const label = labels.nth(i);
        const input = label.locator("input");
        const id = await input.getAttribute("value");
        current = { viewport: viewport.width, kind, id };
        // Prepare the visible card, then use an actual pointer click on its preview.
        await label.evaluate((el) => el.scrollIntoView({ block: "center" }));
        const before = await label.evaluate((el) => ({
          page: scrollY, grid: el.closest("fieldset").scrollTop,
          cardY: el.getBoundingClientRect().y,
          inputY: el.querySelector("input").getBoundingClientRect().y,
        }));
        const box = await label.boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + 24);
        await page.waitForFunction(({ kind, id }) => {
          const el = document.querySelector(`input[name="${kind}-theme"][value="${id}"]`);
          return el.checked && !el.disabled;
        }, { kind, id });
        const after = await label.evaluate((el) => ({ page: scrollY, grid: el.closest("fieldset").scrollTop }));
        results.push({ viewport: viewport.width, kind, id, before, after,
          pageJump: after.page - before.page, gridJump: after.grid - before.grid });
      }
    }
    await page.close();
  }
  const jumps = results.filter((r) => Math.abs(r.pageJump) > 1 || Math.abs(r.gridJump) > 1);
  const output = path.resolve("output/theme-verification");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, process.env.THEME_SCROLL_REPORT || "scroll-result.json"), JSON.stringify({ selections: results.length, jumps, results }, null, 2));
  console.log(JSON.stringify({ selections: results.length, jumps: jumps.length,
    largestPageJump: Math.max(...results.map((r) => Math.abs(r.pageJump))),
    examples: jumps.slice(0, 3) }, null, 2));
  assert.equal(jumps.length, 0, "pointer selections must preserve page and picker scroll positions");
} catch (error) {
  console.error("Scroll check failed", current);
  throw error;
} finally {
  await browser.close();
}
