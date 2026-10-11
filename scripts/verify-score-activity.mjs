import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// Use the bundled browser runtime without adding an application dependency.
const runtime = process.env.CODEX_BROWSER_RUNTIME;
if (!runtime) throw new Error("Set CODEX_BROWSER_RUNTIME to the bundled node_modules directory.");
const require = createRequire(path.join(runtime, "package.json"));
const { chromium } = require("playwright");
const base = process.env.ACTIVITY_PREVIEW_URL || "http://localhost:3100";
const output = path.resolve("output/settings-activity-verification");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: "light" });
const failures = [];
page.on("pageerror", (error) => failures.push(error.message.split("\n")[0]));
page.on("console", (message) => {
  if (message.type() === "error" && /hydrat/i.test(message.text())) failures.push(message.text().split("\n")[0]);
});

try {
  await page.goto(`${base}/settings`);
  await page.getByRole("heading", { name: "Score history", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Your next score starts here" }).waitFor();
  assert.equal(await page.getByRole("button", { name: /points, .*scoring actions/ }).count(), 30);
  await page.screenshot({ path: path.join(output, "desktop-empty.png"), fullPage: true });

  await page.getByRole("link", { name: "Browse problems", exact: true }).click();
  await page.getByRole("heading", { name: "Problems", exact: true }).waitFor();
  // Create real local awards by driving the existing problem actions.
  const row = page.locator("tbody tr").filter({ has: page.getByRole("button", { name: "Solved", exact: true }) }).first();
  await row.waitFor();
  const title = await row.locator(".problem-title").innerText();
  const rowText = await row.innerText();
  const hard = rowText.includes("Hard");
  await row.getByRole("button", { name: "Solved", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
  const revise = row.getByRole("button", { name: "+1 revision", exact: true });
  await revise.click();
  await row.getByText("Revised once", { exact: true }).waitFor();
  // The optimistic label updates before persistence. Wait for the control to settle.
  await page.waitForFunction(() => {
    const row = document.querySelector("tbody tr");
    return row && [...row.querySelectorAll("button")].some((b) => b.textContent.includes("+1 revision") && !b.disabled);
  });
  await revise.click();
  await row.getByText("Revised twice", { exact: true }).waitFor();
  await page.waitForFunction(() => {
    const row = document.querySelector("tbody tr");
    return row && [...row.querySelectorAll("button")].some((b) => b.textContent.includes("+1 revision") && !b.disabled);
  });
  await page.getByRole("link", { name: "Settings & activity", exact: true }).filter({ visible: true }).click();
  await page.getByRole("heading", { name: "Score history", exact: true }).waitFor();
  await page.getByText(title, { exact: true }).first().waitFor();
  const total = hard ? 14 : 7;
  const totals = page.getByRole("definition");
  assert.match(await totals.nth(3).innerText(), new RegExp(`^${total}`));
  assert.equal(await page.locator("ol li").count(), 3);
  const firstRevision = page.getByRole("button", { name: "First revision", exact: true });
  await firstRevision.click();
  assert.equal(await page.locator("ol li").count(), 1);
  assert.match(await totals.nth(3).innerText(), new RegExp(`^${hard ? 4 : 2}`));
  await page.getByRole("button", { name: "Second+ revision", exact: true }).click();
  assert.equal(await page.locator("ol li").count(), 1);
  await page.getByText("Revision 2", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  assert.equal(await page.locator("ol li").count(), 3);

  const zeroDay = page.getByRole("button", { name: /: 0 points, 0 scoring actions/ }).first();
  await zeroDay.click();
  await page.getByRole("heading", { name: "No activity matches these filters" }).waitFor();
  await page.getByRole("button", { name: "Show all activity", exact: true }).click();
  await page.screenshot({ path: path.join(output, "desktop-history.png"), fullPage: true });
  await page.reload();
  await page.getByText(title, { exact: true }).first().waitFor();
  assert.equal(await page.locator("ol li").count(), 3, "history persists across reload");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: path.join(output, "desktop-dark.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByText(title, { exact: true }).first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no mobile page overflow");
  await page.getByText("Account", { exact: true }).click();
  await page.getByRole("link", { name: "Settings & activity", exact: true }).filter({ visible: true }).click();
  assert.equal(await page.locator("header details").evaluate((el) => el.open), false);
  await page.getByRole("button", { name: "First revision", exact: true }).click();
  assert.equal(await page.locator("ol li").count(), 1);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.screenshot({ path: path.join(output, "mobile-history.png"), fullPage: true });
  assert.deepEqual(failures, [], "no browser errors");
  const result = { passed: true, question: title, expectedPoints: total, actions: 3,
    checks: ["empty state", "real solve and two revisions", "stored awards", "action filters", "date filter", "clear filters", "reload", "dark theme", "mobile navigation", "no mobile overflow", "no browser errors"] };
  await writeFile(path.join(output, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
