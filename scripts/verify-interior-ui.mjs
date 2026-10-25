import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.INTERIOR_TEST_URL ?? "http://127.0.0.1:3127";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "UI verification only runs against a local fixture");
const output = "output/verification/interior";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const checks = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
const verify = (name, condition) => { assert.ok(condition, name); checks.push(name); };
const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
try {
  await page.goto(`${base}/dashboard`);
  await page.getByRole("heading", { name: "Daily practice", exact: true }).waitFor();
  verify("dashboard progress bars retain accessible values", await page.getByRole("progressbar").count() > 0);
  await page.screenshot({ path: `${output}/desktop-dashboard.png`, fullPage: true });
  await page.getByRole("navigation", { name: "Main navigation" }).filter({ visible: true }).getByRole("link", { name: "Problems", exact: true }).click();
  await page.getByRole("heading", { name: "Problems", exact: true }).waitFor();
  const search = page.getByRole("textbox", { name: "Search problems" });
  await search.fill("Two Sum");
  await page.waitForURL(/search=/);
  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await page.waitForURL(url => !url.searchParams.has("search"));
  const firstRow = page.locator("tr[data-problem-id]").first();
  const star = firstRow.getByRole("button", { name: /favorite/ });
  const previous = await star.getAttribute("aria-pressed");
  await star.focus();
  await page.getByRole("tooltip").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("tooltip").waitFor({ state: "hidden" });
  await page.keyboard.press("Space");
  await page.waitForFunction(([id, old]) => document.querySelector(`tr[data-problem-id="${id}"] button[aria-pressed]`)?.getAttribute("aria-pressed") !== old,
    [await firstRow.getAttribute("data-problem-id"), previous]);
  verify("favorite keyboard action preserves optimistic state", await star.getAttribute("aria-pressed") !== previous);
  await star.click();
  await page.getByRole("button", { name: "Problem: sort ascending", exact: true }).click();
  verify("ascending sorting retains native semantics", await page.locator('th[aria-sort="ascending"]').count() === 1);
  await page.getByRole("button", { name: "Problem: sort descending", exact: true }).click();
  await page.getByRole("button", { name: "Problem: restore original order", exact: true }).click();
  const next = page.getByRole("button", { name: "Next", exact: true });
  if (await next.count()) {
    await next.click();
    await page.getByText(/Page\s+2\s+of/).waitFor();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    checks.push("pagination and original order preserved");
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/desktop-problems.png`, fullPage: false });

  await page.goto(`${base}/interview`);
  const customize = page.getByRole("switch", { name: "Customize interview" });
  const beforePress = await customize.boundingBox();
  await page.mouse.move(beforePress.x + beforePress.width / 2, beforePress.y + beforePress.height / 2);
  await page.mouse.down();
  await page.mouse.move(beforePress.x - 20, beforePress.y);
  await page.mouse.up();
  verify("abandoned pointer press does not activate the control", await customize.getAttribute("aria-checked") === "false");
  await page.waitForFunction(() => {
    const toggle = document.querySelector('[role="switch"]');
    return ["none", "0px"].includes(getComputedStyle(toggle).translate);
  });
  verify("abandoned press returns to its original position", Math.abs((await customize.boundingBox()).y - beforePress.y) < 1);
  await page.getByRole("switch", { name: "Customize interview" }).click();
  const picked = page.getByRole("radio", { name: "Pick questions", exact: true });
  await picked.check();
  verify("segmented control submits the same form value", await picked.evaluate(input => new FormData(input.form).get("selectionMode")) === "picked");
  const picker = page.getByRole("combobox", { name: "Find a question" });
  await picker.fill("Two Sum");
  await picker.press("ArrowDown");
  await picker.press("Enter");
  verify("question picker adds hidden problem IDs", await page.locator('input[name="problemIds"]').count() > 0);
  const durationBox = await page.getByRole("spinbutton", { name: "Duration in minutes" }).boundingBox();
  const startBox = await page.getByRole("button", { name: "Start new interview", exact: true }).boundingBox();
  verify("custom interview fields do not overlap submit", durationBox.y + durationBox.height <= startBox.y);
  await page.screenshot({ path: `${output}/desktop-interview.png`, fullPage: true });
  await page.getByRole("radio", { name: "Random", exact: true }).check();
  verify("random selection preserves numeric fields", await page.getByRole("spinbutton", { name: "Medium questions" }).count() === 1);
  await page.getByRole("switch", { name: "Customize interview" }).click();
  verify("closed customization does not submit hidden config", await page.locator('input[name="customize"]').count() === 0);

  await page.goto(`${base}/settings`);
  await page.getByRole("radio", { name: "Dark", exact: true }).check();
  await page.getByText("Appearance saved.", { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/desktop-settings-dark.png`, fullPage: true });
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await page.getByText("Appearance saved.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Edit display name" }).click();
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill("Interior test");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  verify("button ref restores edit focus", await page.getByRole("button", { name: "Edit display name" }).evaluate(el => el === document.activeElement));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["dashboard", "problems", "interview", "revise", "settings", "leaderboard"]) {
    await page.goto(`${base}/${route}`);
    await page.locator("main h1").waitFor();
    verify(`mobile ${route} has no viewport overflow`, await overflow());
    await page.screenshot({ path: `${output}/mobile-${route}.png`, fullPage: false });
  }
  await page.goto(`${base}/interview`);
  const toggle = page.getByRole("switch", { name: "Customize interview" });
  await toggle.focus();
  await page.keyboard.down("Space");
  verify("reduced motion disables press displacement", await toggle.evaluate(el => getComputedStyle(el).translate) === "none");
  await page.keyboard.up("Space");
  await page.getByRole("radio", { name: "Pick questions", exact: true }).check();
  verify("reduced motion retains selected state", await page.getByRole("radio", { name: "Pick questions", exact: true }).isChecked());
  verify("no browser runtime errors", errors.length === 0);
  await writeFile(`${output}/result.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(`Interior UI: ${checks.length} checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
}
