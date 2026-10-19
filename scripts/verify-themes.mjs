import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

export async function verifyThemes(base, authenticated = false) {
  const runtime = process.env.CODEX_BROWSER_RUNTIME;
  if (!runtime) throw new Error("Set CODEX_BROWSER_RUNTIME to the bundled node_modules directory.");
  const require = createRequire(path.join(runtime, "package.json"));
  const { chromium } = require("playwright");
  const output = path.resolve(process.env.GOOGLEDSA_VERIFY_BUILD === "true" ? "output/verification/themes" : "output/theme-verification");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
  async function authenticate(target, id = "one") {
    const user = { id: `theme-user-${id}`, email: `${id}@theme.test`, user_metadata: {} };
    const session = { access_token: `theme-${id}`, refresh_token: `refresh-${id}`,
      expires_at: Math.floor(Date.now() / 1000) + 3600, user, token_type: "bearer" };
    await target.addCookies([{ name: "sb-auth-test-auth-token", url: base,
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` }]);
  }
  await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  if (authenticated) await authenticate(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(error.message));
  const color = () => page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    mode: document.documentElement.dataset.themeMode,
    surface: getComputedStyle(document.documentElement).getPropertyValue("--surface").trim(),
  }));
  const settled = () => page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent === "Appearance saved.");
  const mode = async (name) => { await page.getByRole("radio", { name, exact: true }).check(); await settled(); };
  const picker = (name) => page.locator("details").filter({ has: page.locator("summary", { hasText: name }) });
  async function choose(kind, name) {
    const group = picker(`${kind} theme`);
    if (!(await group.evaluate((el) => el.open))) await group.locator("summary").click();
    await group.getByRole("radio", { name, exact: true }).check();
    await settled();
  }
  try {
    await page.goto(`${base}/settings`);
    await page.getByRole("heading", { name: "Appearance", exact: true }).waitFor();
    assert.equal((await color()).background, "rgb(245, 247, 250)");
    await page.emulateMedia({ colorScheme: "dark" });
    assert.equal((await color()).background, "rgb(21, 25, 31)");
    await mode("Light");
    assert.equal((await color()).background, "rgb(245, 247, 250)", "forced light overrides dark OS");
    await choose("Light", "GitHub");
    assert.equal((await color()).background, "rgb(255, 255, 255)");
    await choose("Dark", "Dracula");
    assert.equal((await color()).background, "rgb(255, 255, 255)", "inactive dark palette does not change light mode");
    await mode("Dark");
    assert.equal((await color()).background, "rgb(40, 42, 54)");
    await page.emulateMedia({ colorScheme: "light" });
    assert.equal((await color()).background, "rgb(40, 42, 54)", "forced dark overrides light OS");
    await page.screenshot({ path: path.join(output, "desktop-dracula.png"), fullPage: true });
    await page.reload();
    await page.getByRole("heading", { name: "Appearance", exact: true }).waitFor();
    assert.equal((await color()).background, "rgb(40, 42, 54)", "saved theme survives reload");
    await mode("System");
    assert.equal((await color()).background, "rgb(255, 255, 255)");
    await page.emulateMedia({ colorScheme: "dark" });
    assert.equal((await color()).background, "rgb(40, 42, 54)", "system tracks OS changes live");

    // Check every bundled palette on the actual page, including legacy utility-based components.
    const palettes = JSON.parse(await (await import("node:fs/promises")).readFile("lib/themes/pomotroid.json", "utf8"));
    for (const kind of ["Light", "Dark"]) {
      await mode(kind);
      const group = picker(`${kind} theme`);
      if (!(await group.evaluate((el) => el.open))) await group.locator("summary").click();
      const radios = group.getByRole("radio");
      for (let i = 1; i < await radios.count(); i++) {
        const radio = radios.nth(i);
        const id = await radio.getAttribute("value");
        await radio.check(); await settled();
        const palette = palettes.find((p) => p.id === id);
        const bg = palette.colors["--color-background"];
        const expected = `rgb(${[1, 3, 5].map((n) => parseInt(bg.slice(n, n + 2), 16)).join(", ")})`;
        assert.equal((await color()).background, expected, id);
        assert.equal((await color()).surface.toLowerCase(), palette.colors["--color-background-light"].toLowerCase());
        const button = await page.locator(".button-link").first().evaluate((el) => ({
          color: getComputedStyle(el).color,
          expected: getComputedStyle(document.documentElement).getPropertyValue("--accent-contrast").trim(),
        }));
        assert.equal(button.color, button.expected === "#000000" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)", `${id}: readable primary button`);
      }
    }
    await choose("Dark", "Dracula");
    await mode("System");
    await page.emulateMedia({ colorScheme: "light" });
    await choose("Light", "Rosé Pine Dawn");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, "mobile-rose-pine.png"), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no mobile overflow");
    // Native radios remain operable by keyboard.
    await page.getByRole("radio", { name: "System", exact: true }).focus();
    await page.keyboard.press("ArrowRight"); await settled();
    assert.equal((await color()).mode, "light");
    await page.getByRole("link", { name: "Problems", exact: true }).filter({ visible: true }).first().click();
    await page.waitForURL("**/problems");
    assert.equal((await color()).background, "rgb(250, 244, 237)", "theme persists through navigation");
    await page.goto(`${base}/settings`);
    await page.getByRole("heading", { name: "Appearance", exact: true }).waitFor();

    if (authenticated) {
      const firstPaint = await browser.newContext({ javaScriptEnabled: false, colorScheme: "light" });
      await firstPaint.addCookies(await context.cookies());
      const unhydratedPage = await firstPaint.newPage();
      await unhydratedPage.goto(`${base}/settings`);
      assert.equal(await unhydratedPage.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(250, 244, 237)", "saved theme renders before JavaScript");
      await firstPaint.close();
      const device = await browser.newContext({ colorScheme: "light" });
      await authenticate(device);
      const otherDevice = await device.newPage();
      await otherDevice.goto(`${base}/settings`);
      assert.equal(await otherDevice.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(250, 244, 237)", "account preference syncs to another device");
      await device.close();
      const other = await browser.newContext({ colorScheme: "light" });
      await authenticate(other, "two");
      const otherUser = await other.newPage();
      await otherUser.goto(`${base}/settings`);
      assert.equal(await otherUser.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(245, 247, 250)", "other account keeps defaults");
      await other.close();
    }
    // Failed persistence must restore the previous theme and report an error.
    await page.route("**/settings", async (route) => route.request().method() === "POST"
      ? route.abort() : route.continue());
    await page.getByRole("radio", { name: "Dark", exact: true }).check();
    await page.getByRole("alert").filter({ hasText: "Your theme could not be saved" }).waitFor();
    assert.equal((await color()).background, "rgb(250, 244, 237)");
    await page.unroute("**/settings");
    await page.getByRole("button", { name: "Reset to defaults" }).click(); await settled();
    assert.equal((await color()).background, "rgb(245, 247, 250)");
    await page.emulateMedia({ colorScheme: "dark" });
    assert.equal((await color()).background, "rgb(21, 25, 31)");
    await page.screenshot({ path: path.join(output, "mobile-default-dark.png"), fullPage: true });
    assert.deepEqual(failures, []);
    const result = { passed: true, authenticated, palettes: 38,
      checks: ["original defaults", "forced modes", "independent light/dark choices", "all palettes", "button contrast", "reload", "system changes", "mobile overflow", "keyboard", "navigation", "failed save rollback", "reset", ...(authenticated ? ["theme before JavaScript", "cross-device persistence", "account isolation"] : [])] };
    await writeFile(path.join(output, authenticated ? "account-result.json" : "local-result.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
}

if (process.env.THEME_PREVIEW_URL) await verifyThemes(process.env.THEME_PREVIEW_URL);
