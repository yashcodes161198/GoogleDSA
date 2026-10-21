import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createRevisionDb, revisionUser, otherRevisionUser } from "./fixtures/revision-db.mjs";

process.env.USE_LOCAL_DB = "false";
process.env.NEXT_PUBLIC_USE_LOCAL_DB = "false";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.GOOGLEDSA_VERIFY_BUILD = "true";
process.env.NODE_ENV = "production";
const db = await createRevisionDb();
const users = [revisionUser, otherRevisionUser].map(id => ({ id, email: "revision@example.invalid", aud: "authenticated", app_metadata: {}, user_metadata: {} }));
const failures = { load: false, replace: false, revise: false };
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
  if (["localhost", "127.0.0.1"].includes(url.hostname)) return originalFetch(input, init);
  assert.equal(url.origin, "https://auth-test.supabase.co", "fixture blocks external traffic");
  const headers = new Headers(init?.headers ?? input.headers);
  const user = users[headers.get("authorization") === "Bearer revision-2" ? 1 : 0];
  if (url.pathname === "/auth/v1/user") return Response.json(user);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  try {
    const result = await db.transaction(async tx => {
      await tx.exec("SET LOCAL ROLE authenticated");
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user.id]);
      if (url.pathname === "/rest/v1/problems") return (await tx.query("SELECT * FROM problems WHERE $1::uuid IS NULL OR id>$1::uuid ORDER BY id", [url.searchParams.get("id")?.replace(/^gt\./, "") ?? null])).rows
        .map(row => ({ ...row, frequency: Number(row.frequency), acceptance_rate: Number(row.acceptance_rate) }));
      if (url.pathname === "/rest/v1/user_problems") return (await tx.query("SELECT * FROM user_problems WHERE $1::uuid IS NULL OR problem_id>$1::uuid ORDER BY problem_id", [url.searchParams.get("problem_id")?.replace(/^gt\./, "") ?? null])).rows;
      if (url.pathname.endsWith("/rpc/get_revision_session")) {
        if (body.p_expected_version === null ? failures.load : failures.replace) throw new Error("Injected session failure");
        return (await tx.query("SELECT get_revision_session($1) AS result", [body.p_expected_version])).rows[0].result;
      }
      if (url.pathname.endsWith("/rpc/mutate_problem_progress")) {
        if (failures.revise && body.p_operation === "revise") throw new Error("Injected revision failure");
        return (await tx.query("SELECT mutate_problem_progress($1,$2,$3,$4) AS result",
          [body.p_problem_id, body.p_operation, JSON.stringify(body.p_value), body.p_request_id])).rows[0].result;
      }
      throw new Error(`Unexpected fixture request: ${url.pathname}`);
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ code: "FIXTURE", message: error.message }, { status: 503 });
  }
};

const { default: next } = await import("next");
let handle;
const server = createServer((request, response) => handle(request, response));
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const app = next({ dev: false, hostname: "127.0.0.1", port: server.address().port, httpServer: server });
let browser;
const pages = [];
const errors = [];
const output = "output/verification/revision-session";
try {
  await app.prepare();
  handle = app.getRequestHandler();
  const base = `http://localhost:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
  async function device(number = 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const session = { access_token: `revision-${number}`, refresh_token: `refresh-${number}`, expires_at: Math.floor(Date.now() / 1000) + 3600, user: users[number - 1], token_type: "bearer" };
    await context.addCookies([{ name: "sb-auth-test-auth-token", url: base, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` }]);
    await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await context.route("https://auth-test.supabase.co/**", route => route.fulfill({ json: users[number - 1] }));
    const page = await context.newPage();
    pages.push(page);
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`${base}/revise`);
    return page;
  }
  const boxes = page => page.locator('input[id^="revised-"]');
  const titles = page => page.locator("article.practice-row h2").allTextContents();
  const replace = page => page.getByRole("button", { name: "Replace revised questions" });
  const settled = page => page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Replace revised questions"]');
    return button && !button.disabled;
  });
  failures.load = true;
  const page = await device();
  await page.getByRole("alert").filter({ hasText: "saved revision list" }).waitFor();
  assert.equal(await boxes(page).count(), 0, "a failed session load must not generate an unsaved list");
  failures.load = false;
  await page.getByRole("button", { name: "Reload saved list" }).click();
  await boxes(page).nth(9).waitFor();
  const initialTitles = await titles(page);
  failures.revise = true;
  await boxes(page).first().check();
  await page.getByRole("alert").filter({ hasText: "Could not save this revision" }).waitFor();
  await settled(page);
  assert.equal(await boxes(page).first().isChecked(), false, "failed saves roll back the checkmark");
  failures.revise = false;
  for (let index = 0; index < 5; index++) {
    await boxes(page).nth(index).check();
    await settled(page);
  }
  await page.getByText("5 of 10 revised in this list", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Problems", exact: true }).filter({ visible: true }).click();
  await page.getByRole("heading", { name: "Problems", exact: true }).waitFor();
  await page.getByRole("link", { name: "Revise", exact: true }).filter({ visible: true }).click();
  await page.getByText("5 of 10 revised in this list", { exact: true }).waitFor();
  assert.deepEqual(await titles(page), initialTitles);
  await page.reload();
  await page.getByText("5 of 10 revised in this list", { exact: true }).waitFor();
  assert.deepEqual(await titles(page), initialTitles, "reload keeps all ten questions");

  await db.exec("UPDATE user_problems SET last_revised_at=now()-interval '7 days' WHERE revision_count>0");
  const second = await device();
  await second.getByText("5 of 10 revised in this list", { exact: true }).waitFor();
  assert.deepEqual(await titles(second), initialTitles, "a new device resumes old completion dates");
  failures.replace = true;
  await replace(page).click();
  await page.getByRole("alert").filter({ hasText: "saved revision list" }).waitFor();
  assert.deepEqual(await titles(page), initialTitles, "failed replacement preserves the list");
  failures.replace = false;
  await settled(page);
  await replace(page).click();
  await page.getByText("0 of 10 revised in this list", { exact: true }).waitFor();
  await settled(page);
  const newTitles = await titles(page);
  assert.deepEqual(newTitles.slice(0, 5), initialTitles.slice(5), "unchecked questions stay in the next list");
  assert.ok(initialTitles.slice(0, 5).every(title => !newTitles.includes(title)));
  await replace(second).click();
  await second.getByText("0 of 10 revised in this list", { exact: true }).waitFor();
  assert.deepEqual(await titles(second), newTitles, "a stale device receives the current list");
  await page.reload();
  await boxes(page).nth(9).waitFor();
  assert.deepEqual(await titles(page), newTitles, "replacement persists across reloads");
  const other = await device(2);
  await other.getByText("No questions in this revision list", { exact: true }).waitFor();
  assert.equal(await boxes(other).count(), 0, "account isolation");
  await settled(other);
  assert.equal(await replace(other).isEnabled(), true, "empty list still offers explicit replacement");
  await mkdir(output, { recursive: true });
  await second.screenshot({ path: `${output}/replaced.png`, fullPage: true });
  assert.deepEqual(errors, []);
  const result = { passed: true, checks: ["load retry", "failed revision rollback", "five of ten", "navigation", "reload", "new device", "old completion dates", "failed replacement", "explicit replacement", "stale device", "account isolation", "empty list", "no browser errors"] };
  await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  console.error({ browserErrors: errors });
  for (const page of pages) console.error({ url: page.url(), text: (await page.locator("body").innerText()).slice(0, 2500) });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await app.close();
  await db.close();
}
