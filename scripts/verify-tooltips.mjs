import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

export async function verifyFavoriteTooltips(page, { rows = "tr[data-problem-id]" } = {}) {
  const results = [];
  const visibleTooltip = async name => {
    const tooltip = page.getByRole("tooltip");
    await tooltip.waitFor();
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[role="tooltip"]')).opacity) > .99);
    const visibility = await tooltip.evaluate(el => {
      const r = el.getBoundingClientRect();
      const previous = el.style.pointerEvents;
      el.style.pointerEvents = "auto";
      const points = [[r.left + 6, r.top + 6], [r.right - 6, r.top + 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.bottom - 6]];
      const painted = points.every(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        return hit === el || el.contains(hit);
      });
      el.style.pointerEvents = previous;
      return { painted, inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        bounds: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } };
    });
    assert.ok(visibility.inViewport && visibility.painted, `${name}: tooltip is cut off or covered: ${JSON.stringify(visibility)}`);
    results.push(name);
  };
  const originalViewport = page.viewportSize();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.reload();
    const star = page.locator(rows).first().getByRole("button", { name: /favorite/ });
    await star.waitFor();
    await star.hover();
    await visibleTooltip(`${width}px pointer hover`);
    await page.keyboard.press("Escape");
    await page.getByRole("tooltip").waitFor({ state: "hidden" });
    await page.mouse.move(width - 5, 5);
    await star.focus();
    await visibleTooltip(`${width}px keyboard focus`);
    assert.equal(await star.getAttribute("aria-describedby"), await page.getByRole("tooltip").getAttribute("id"));
    await page.keyboard.press("Escape");
    await page.getByRole("tooltip").waitFor({ state: "hidden" });

    await star.evaluate(el => { el.blur(); window.scrollBy({ top: el.getBoundingClientRect().top - 8, behavior: "instant" }); });
    const edgeBox = await star.boundingBox();
    await page.mouse.move(edgeBox.x + edgeBox.width / 2, edgeBox.y + edgeBox.height / 2);
    await visibleTooltip(`${width}px top viewport edge`);
    const starBox = await star.boundingBox();
    const tipBox = await page.getByRole("tooltip").boundingBox();
    assert.ok(tipBox.y >= starBox.y + starBox.height, `tooltip should flip below a trigger at the top edge: ${JSON.stringify({ starBox, tipBox })}`);
    await page.mouse.move(width - 5, 5);
    await page.getByRole("tooltip").waitFor({ state: "hidden" });
  }
  await page.setViewportSize(originalViewport);
  await page.reload();
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.env.INTERIOR_TEST_URL ?? "http://127.0.0.1:3127";
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/problems`);
    console.log(await verifyFavoriteTooltips(page));
  } finally { await browser.close(); }
}
