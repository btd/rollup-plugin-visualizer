import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Review the portable sketch, independently of production bundles and snapshots.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const failures = [];
const checks = [];
const url = new URL("./treemap-inspector.html", import.meta.url).href;
const screenshotDirectory = process.env.INSPECTOR_SCREENSHOTS;
if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
const pauseLayout = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const rectangles = page => page.locator(".map-group, .map-leaf").evaluateAll(elements => elements.map(element => {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { id: element.dataset.node, x, y, width, height };
}));
const scrollList = async (page, pixels) => {
  const list = page.locator(".relationship-list");
  await list.hover();
  await page.mouse.wheel(0, pixels);
  await page.waitForFunction(() => document.querySelector(".relationship-list").scrollTop > 100);
  return list.evaluate(element => element.scrollTop);
};
async function check(name, run, viewport = { width: 1280, height: 800 }) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(5000);
  const errors = [];
  const requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  page.on("request", request => requests.push(request.url()));
  try {
    await page.goto(url);
    await pauseLayout(page);
    await run(page);
    assert.deepEqual(errors, [], "browser errors/warnings");
    assert.deepEqual(requests.filter(request => !request.startsWith("file:")), [], "unexpected network requests");
    checks.push(name);
    console.log("PASS " + name);
  } catch (error) {
    failures.push(name);
    console.error("FAIL " + name + ": " + error.message.slice(0, 600));
  } finally {
    await page.close();
  }
}
try {
  await check("output membership and both relationship endpoints", async page => {
    await page.locator(".case-select").selectOption("baseline");
    await page.locator('[data-section="members"]').click();
    const paths = await page.locator(".relation-row .row-path").allTextContents();
    assert.equal(paths.length, 6);
    assert(!paths.includes("node_modules/recharts/es6/index.js"));
    await page.locator('[data-section="incoming"]').click();
    const rows = await page.locator(".relation-row").allTextContents();
    assert.equal(rows.length, 3);
    assert(rows.some(row => row.includes("index.js") && row.includes("LineChart.js")));
    assert(rows.some(row => row.includes("index.js") && row.includes("Tooltip.js")));
    assert(rows.some(row => row.includes("TrafficChart.tsx") && row.includes("Line.js")));
    await page.locator('[data-inspect="barrel"]').first().click();
    assert.match(await page.locator(".identity-type").innerText(), /Graph-only/);
    assert(await page.locator(".show-chart").isDisabled());
    assert((await page.locator(".relation-row").allTextContents()).some(row => row.includes("RevenueChart.tsx")));
  });
  await check("closed selection and reopen keep chart geometry and held context", async page => {
    await page.locator(".close-inspector").click();
    await pauseLayout(page);
    const before = await rectangles(page);
    await page.locator('[data-node="source"] .group-heading').click();
    assert(await page.locator(".inspector").isHidden());
    assert.deepEqual(await rectangles(page), before);
    await page.locator(".inspector-toggle").click();
    await pauseLayout(page);
    assert.equal(await page.locator(".identity-path").inputValue(), "src");
    const open = await rectangles(page);
    await page.locator('[data-node="react"] .group-heading').click();
    assert.deepEqual(await rectangles(page), open);
    await page.locator('[data-node="source"] .group-heading').hover();
    assert.equal(await page.locator(".identity-path").inputValue(), "node_modules/react");
  });
  await check("search, navigation, Back, and metric preserve investigation context", async page => {
    await page.locator(".path-search").fill("ROUTE-");
    const before = await rectangles(page);
    const position = await scrollList(page, 1800);
    const visibleId = await page.locator(".relationship-list").evaluate(list => {
      const bounds = list.getBoundingClientRect();
      return [...list.querySelectorAll(".relation-row")].find(row => {
        const rect = row.getBoundingClientRect();
        return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
      })?.dataset.inspect;
    });
    assert(visibleId, "a full row must remain usable in the scrolling list");
    await page.locator(`[data-inspect="${visibleId}"]`).click();
    await page.locator(".history-back").click();
    assert.equal(await page.locator(".path-search").inputValue(), "ROUTE-");
    assert.equal(await page.locator(".relationship-list").evaluate(element => element.scrollTop), position);
    assert.deepEqual(await rectangles(page), before);
    await page.locator(".metric-control select").selectOption("gzip");
    assert.equal(await page.locator(".path-search").inputValue(), "ROUTE-");
    assert.equal(await page.locator(".relationship-list").evaluate(element => element.scrollTop), position);
    await page.locator(".path-search").fill("");
    assert.equal(await page.locator(".relationship-list").evaluate(element => element.scrollTop), 0);
    assert.match(await page.locator(".relationship-scope").innerText(), /259/);
  });
  await check("literal search and deterministic path ordering", async page => {
    const paths = await page.locator(".relation-row .row-path").allTextContents();
    assert.deepEqual(paths, [...paths].sort());
    await page.locator(".path-search").fill(" ");
    assert.equal(await page.locator(".relation-row").count(), 0);
    await page.locator(".path-search").fill("[route");
    assert.equal(await page.locator(".relation-row").count(), 0);
  });
  await check("identical imports deduplicate while static and dynamic imports stay distinct", async page => {
    await page.locator(".case-select").selectOption("kinds");
    assert.equal(await page.locator(".relation-row").count(), 4);
    const rows = await page.locator('[data-inspect="app"]').allTextContents();
    assert.equal(rows.length, 2);
    assert(rows[0].includes("react.production.js") && rows[0].includes("static"));
    assert(rows[1].includes("react.production.js") && rows[1].includes("dynamic"));
  });
  await check("hidden target stays inspectable and filters change only deliberately", async page => {
    await page.locator(".case-select").selectOption("filtered");
    const path = await page.locator(".identity-path").inputValue();
    const rows = await page.locator(".relation-row").allTextContents();
    assert.match(await page.locator(".graph-note").innerText(), /hidden/i);
    assert(await page.locator(".show-chart").isDisabled());
    assert.equal(await page.locator('[data-node="reactcore"]').count(), 0);
    await page.getByLabel("Hide React output in chart").uncheck();
    assert.equal(await page.locator(".identity-path").inputValue(), path);
    assert.deepEqual(await page.locator(".relation-row").allTextContents(), rows);
    await page.locator(".show-chart").click();
    assert.equal(await page.locator(".map-leaf").count(), 1);
    assert.equal(await page.locator(".map-leaf").getAttribute("data-node"), "reactcore");
    await page.locator('[data-zoom="overview"]').click();
    assert((await page.locator(".map-leaf").count()) > 1);
    assert.equal(await page.locator(".identity-path").inputValue(), path);
  });
  await check("tiny files have exact deliberate chart focus", async page => {
    await page.locator(".case-select").selectOption("tiny");
    await page.locator(".path-search").fill("small-099");
    await page.locator(".relation-row").click();
    assert.equal(await page.locator(".primary-size").innerText(), "1 B");
    await page.locator(".show-chart").click();
    const leaf = page.locator('.map-leaf[data-node="small-099"]');
    const bounds = await leaf.boundingBox();
    assert(bounds.width > 200 && bounds.height > 100);
    assert.equal(await page.locator(".map-leaf").count(), 1);
    await page.locator(".history-back").click();
    assert.equal(await page.locator(".path-search").inputValue(), "small-099");
    assert.equal(await page.locator(".map-leaf").count(), 1, "Back must not move the chart");
  });
  await check("Unicode manual copy selects the complete ID in UTF-16 code units", async page => {
    await page.locator(".case-select").selectOption("long");
    const path = await page.locator(".identity-path").inputValue();
    assert(path.length > 200 && path.includes("😀") && path.includes("café"));
    await page.context().clearPermissions();
    await page.locator(".copy-path").click();
    await page.waitForFunction(() => /Copied|Path selected/.test(document.querySelector(".interaction-status").textContent));
    const message = await page.locator(".interaction-status").innerText();
    if (message.startsWith("Path selected")) {
      assert.deepEqual(await page.locator(".identity-path").evaluate(element => [element.selectionStart, element.selectionEnd]), [0, path.length]);
    } else {
      assert.equal(message, "Copied " + path);
    }
    await page.locator(".relation-row").click();
    assert.notEqual(await page.locator(".identity-path").inputValue(), path);
    await page.locator(".history-back").click();
    assert.equal(await page.locator(".identity-path").inputValue(), path);
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 800, height: 600 }]) {
    await check(`desktop ${viewport.width}×${viewport.height} fits long IDs and lists (CSS pixels)`, async page => {
      await page.locator(".case-select").selectOption("long");
      const panel = await page.locator(".inspector").boundingBox();
      const chart = await page.locator(".treemap-area").boundingBox();
      const list = await page.locator(".relationship-list").boundingBox();
      if (screenshotDirectory) await page.screenshot({ path: `${screenshotDirectory}/inspector-${viewport.width}.png` });
      console.log("LAYOUT " + JSON.stringify({ viewport, panel, chart, listHeight: list.height }));
      assert(panel.width >= 300 && panel.width <= 380);
      assert(chart.width >= 400);
      assert(panel.y + panel.height <= viewport.height - 14);
      assert(list.height >= 60, `relationship list is only ${list.height} CSS pixels tall`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
      await page.locator(".case-select").selectOption("many");
      const position = await scrollList(page, 900);
      await page.setViewportSize({ width: viewport.width + 80, height: viewport.height + 40 });
      await pauseLayout(page);
      assert.equal(await page.locator(".identity-path").inputValue(), "node_modules/react");
      assert.equal(await page.locator(".relationship-list").evaluate(element => element.scrollTop), position);
    }, viewport);
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify({ prototype: fileURLToPath(url), passed: checks.length, failed: failures }));
if (failures.length) process.exitCode = 1;
