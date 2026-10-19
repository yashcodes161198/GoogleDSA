import assert from "node:assert/strict";
import { createServer, type RequestListener } from "node:http";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import next from "next";
import { LOCAL_ADMIN } from "../lib/config";
import { leaderboardWeekBounds } from "../lib/leaderboard/points";
import { getMemoryStore } from "../lib/memory/store";

async function main() {
  const runtime = process.env.CODEX_BROWSER_RUNTIME;
  if (!runtime) throw new Error("Set CODEX_BROWSER_RUNTIME to the bundled node_modules directory.");
  const require = createRequire(path.join(runtime, "package.json"));
  const { chromium } = require("playwright");
  process.env.USE_LOCAL_DB = "true";
  process.env.NEXT_PUBLIC_USE_LOCAL_DB = "true";
  process.env.NODE_ENV = "production";
  const output = path.resolve(process.env.LEADERBOARD_VERIFICATION_OUTPUT || "output/leaderboard-history-verification");
  await mkdir(output, { recursive: true });

  const store = getMemoryStore();
  const hard = store.getProblemsCatalog().find((problem) => problem.difficulty === "HARD")!;
  const otherUser = "00000000-0000-0000-0000-000000000002";
  const { start } = leaderboardWeekBounds();
  store.awardSolve(otherUser, hard.id, start);
  store.awardRevision(otherUser, hard.id, 1, new Date(start.getTime() + 60_000));
  store.awardRevision(otherUser, hard.id, 2, new Date(start.getTime() + 120_000));
  store.awardSolve(LOCAL_ADMIN.id, hard.id, start);

  let handle: RequestListener;
  const server = createServer((request, response) => handle(request, response));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const app = next({ dev: false, hostname: "127.0.0.1", port: address.port, httpServer: server });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, colorScheme: "light" });
  const errors: string[] = [];
  page.on("pageerror", (error: Error) => errors.push(error.message));
  page.on("console", (message: { type(): string; text(): string }) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
  });
  const base = `http://localhost:${address.port}`;
  try {
    await app.prepare();
    handle = app.getRequestHandler();
    await page.goto(`${base}/leaderboard`);
    const leader = page.getByRole("link", { name: "View Player's score history", exact: true });
    await leader.waitFor();
    assert.equal(await page.getByRole("link", { name: /^View .+'s score history$/ }).count(), 2);
    assert.match(await leader.locator("xpath=..").innerText(), /14 pts/);
    await leader.focus();
    await page.keyboard.press("Enter");
    const history = page.getByRole("region", { name: "Player's score history", exact: true });
    await history.waitFor();
    assert.match(await history.getByRole("definition").first().innerText(), /^14/);
    assert.equal(await history.getByRole("button", { name: /points, .*scoring actions/ }).count(), 7);
    assert.equal(await history.locator("ol li").count(), 3);
    await history.getByText(hard.title, { exact: true }).first().waitFor();
    await history.getByRole("button", { name: "First revision", exact: true }).click();
    await history.locator("ol li").nth(1).waitFor({ state: "hidden" });
    await history.locator("ol li").first().waitFor();
    assert.equal(await history.locator("ol li").count(), 1);
    assert.match(await history.getByRole("definition").first().innerText(), /^4/);
    await history.getByRole("button", { name: "Clear filters", exact: true }).click();
    await history.getByRole("button", { name: /: 0 points, 0 scoring actions/ }).first().click();
    await history.getByRole("heading", { name: "No activity matches these filters" }).waitFor();
    await history.getByRole("button", { name: "Show all activity", exact: true }).click();
    await page.screenshot({ path: path.join(output, "desktop-history.png"), fullPage: true });
    await page.reload();
    await history.waitFor();
    assert.equal(await history.locator("ol li").count(), 3, "selected player survives reload");
    await page.getByRole("link", { name: "View admin's score history", exact: true }).click();
    const ownHistory = page.getByRole("region", { name: "admin's score history", exact: true });
    await ownHistory.waitFor();
    assert.equal(await ownHistory.locator("ol li").count(), 1, "runner-up history contains only their awards");
    assert.match(await ownHistory.getByRole("definition").first().innerText(), /^8/);
    assert.equal(await history.count(), 0);
    await page.getByRole("link", { name: "Hide admin's score history", exact: true }).click();
    await ownHistory.waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "View Player's score history", exact: true }).click();
    await history.waitFor();
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: path.join(output, "desktop-dark-history.png"), fullPage: true });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await history.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no mobile page overflow");
    const chart = history.locator('[aria-label="Daily scores for this leaderboard week"]');
    assert.equal(await chart.evaluate((element: HTMLElement) => element.scrollWidth <= element.clientWidth), true,
      "all seven days fit the mobile chart");
    await history.getByRole("button", { name: "Second+ revision", exact: true }).click();
    await history.locator("ol li").nth(1).waitFor({ state: "hidden" });
    await history.locator("ol li").first().waitFor();
    assert.equal(await history.locator("ol li").count(), 1);
    await history.getByRole("button", { name: "Clear filters", exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, "mobile-history.png"), fullPage: true });

    await page.goto(`${base}/leaderboard?user=not-a-player`);
    assert.equal(await page.locator("#leaderboard-score-history").count(), 0, "unknown player does not load history");
    await page.goto(`${base}/settings`);
    const settingsHistory = page.getByRole("region", { name: "Score history", exact: true });
    await settingsHistory.waitFor();
    assert.equal(await settingsHistory.getByRole("button", { name: /points, .*scoring actions/ }).count(), 30);
    assert.equal(await settingsHistory.locator("ol li").count(), 1, "settings remains scoped to the current player");
    assert.deepEqual(errors, [], "no browser or hydration errors");
    console.log("leaderboard browser checks passed: every player, keyboard, daily chart, action/date filters, reload, switching, closing, mobile, dark theme, settings");
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
    throw error;
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
