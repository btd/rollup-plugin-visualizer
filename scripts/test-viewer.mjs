import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { chromium, firefox, webkit } from "playwright";
import { rollup } from "rollup";
import { visualizer } from "../dist/plugin/index.js";
import { decodeFragment, encodeFragment } from "../dist/shared/share/transport.js";

const root = path.resolve(import.meta.dirname, "../dist/viewer");
const mount = "/viewer-fixture/",
  requests = [];
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "visualizer-viewer-"));
const server = http.createServer(async (req, res) => {
  requests.push({ method: req.method, url: req.url });
  res.setHeader("Cache-Control", "no-store");
  if (req.url === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith(mount)) throw new Error("Missing route");
    const relative = decodeURIComponent(url.pathname.slice(mount.length));
    const file = path.resolve(
      root,
      relative + (relative.endsWith("/") || !relative ? "index.html" : ""),
    );
    if (!file.startsWith(root + path.sep)) throw new Error("Missing route");
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
    res.setHeader("Content-Type", types[path.extname(file)] ?? "application/octet-stream");
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`,
  base = origin + mount;

const bundle = await rollup({
  input: "/viewer/入口😀.js",
  plugins: [
    {
      name: "viewer-fixture",
      resolveId: (id) => id,
      load: (id) =>
        id.endsWith("入口😀.js")
          ? "import { value } from '/viewer/value.js'; console.log(value);"
          : "export const value = Math.random();",
    },
    visualizer({
      template: "raw-data",
      filename: "report.json",
      emitFile: true,
      projectRoot: "/viewer/",
    }),
  ],
});
const output = await bundle.generate({ format: "es" });
await bundle.close();
const data = JSON.parse(
  output.output.find((file) => file.type === "asset" && file.fileName === "report.json").source,
);
const jsonFile = {
  name: "report.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(data)),
};

const readyLink = async (page) => {
  await page.waitForFunction(
    () => document.querySelector("#report-form").getAttribute("aria-busy") === "false",
    { timeout: 30_000 },
  );
  assert(!(await page.locator("#result").isHidden()), await page.locator("#status").innerText());
  return page.locator("#open-report").getAttribute("href");
};
const readyReport = async (page) => {
  await page.waitForFunction(
    () => ["ready", "error"].includes(document.querySelector("main").dataset.viewerState),
    { timeout: 30_000 },
  );
  assert.equal(
    await page.locator("main").getAttribute("data-viewer-state"),
    "ready",
    await page.locator("main").innerText(),
  );
};
const empty = { ...data, tree: { name: "root", children: [] }, nodeMetas: {}, nodeParts: {} };
const engines = { chromium, firefox, webkit };
let browser;
let peakRssBytes = 0,
  sampling = false;
const sampleRss = async () => {
  if (sampling || process.platform !== "linux") return;
  sampling = true;
  try {
    const pending = [process.pid],
      seen = new Set();
    let total = 0;
    while (pending.length) {
      const pid = pending.pop();
      if (seen.has(pid)) continue;
      seen.add(pid);
      try {
        const [status, children] = await Promise.all([
          fs.readFile(`/proc/${pid}/status`, "utf8"),
          fs.readFile(`/proc/${pid}/task/${pid}/children`, "utf8"),
        ]);
        total += Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
        pending.push(...children.trim().split(/\s+/).filter(Boolean).map(Number));
      } catch {
        /* A child may exit while the process tree is sampled. */
      }
    }
    peakRssBytes = Math.max(peakRssBytes, total);
  } finally {
    sampling = false;
  }
};
const memoryTimer = process.env.VIEWER_MEASURE_MEMORY
  ? setInterval(() => {
      void sampleRss();
    }, 100)
  : undefined;
try {
  for (const name of (process.env.VIEWER_TEST_BROWSERS ?? "chromium,firefox,webkit").split(",")) {
    assert(engines[name], `Unknown browser: ${name}`);
    // Playwright's WebKit screenshot helper injects inline CSS blocked by our CSP.
    // Capture visuals in Chromium/Firefox and retain WebKit's runtime CSP checks.
    const captureScreenshots = !!process.env.VIEWER_SCREENSHOT_DIR && name !== "webkit";
    peakRssBytes = 0;
    browser = await engines[name].launch({
      headless: true,
      ...(name === "chromium" && process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
      ...(name === "chromium" ? { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] } : {}),
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const errors = [],
      external = [];
    context.on("page", (page) => {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("request", (req) => {
        if (/^https?:/.test(req.url()) && !req.url().startsWith(origin + "/"))
          external.push(req.url());
      });
    });
    const page = await context.newPage();
    await page.goto(base);
    assert.equal(await page.locator('input[type="file"]').count(), 1);
    assert.equal(await page.locator('input[name="template"]').count(), 6);
    if (captureScreenshots) {
      await fs.mkdir(process.env.VIEWER_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.VIEWER_SCREENSHOT_DIR, `${name}-empty.png`),
      });
    }
    await page.setViewportSize({ width: 960, height: 720 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "125%";
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.locator('input[name="template"][value="treemap"]').focus();
    await page.keyboard.press("ArrowRight");
    assert(await page.locator('input[name="template"][value="sunburst"]').isChecked());
    await page.keyboard.press("ArrowLeft");
    assert(await page.locator('input[name="template"][value="treemap"]').isChecked());
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("font-size");
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    const chooserReady = page.waitForEvent("filechooser");
    await page.locator("#drop-target").click();
    await (await chooserReady).setFiles(jsonFile);
    const first = await readyLink(page);
    assert.equal(page.url(), base);
    assert(
      await page
        .locator("#open-report")
        .evaluate((node) => node.getBoundingClientRect().bottom <= window.innerHeight),
    );
    assert.equal(context.pages().length, 1);
    assert.deepEqual((await decodeFragment(new URL(first).hash)).data, data);
    await page.evaluate((json) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([json], "dropped.json", { type: "application/json" }));
      const target = document.querySelector("#drop-target");
      const icon = target.querySelector(".drop-icon");
      target.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer }));
      icon.dispatchEvent(new DragEvent("dragenter", { bubbles: true, dataTransfer: transfer }));
      icon.dispatchEvent(new DragEvent("dragleave", { bubbles: true, dataTransfer: transfer }));
      if (!target.classList.contains("dragging"))
        throw new Error("Nested drag leave cleared the drop highlight");
      target.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    }, jsonFile.buffer.toString("utf8"));
    assert.deepEqual((await decodeFragment(new URL(await readyLink(page)).hash)).data, data);
    assert.equal(await page.locator("#file-name").innerText(), "dropped.json");
    assert.equal(
      await page.locator("#drop-target").evaluate((node) => node.classList.contains("dragging")),
      false,
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.copiedReportLink = text;
          },
        },
      });
    });
    await page.locator("#copy-link").click();
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("copied"),
    );
    assert.equal(await page.evaluate(() => window.copiedReportLink), first);
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("Clipboard denied");
      };
    });
    await page.locator("#copy-link").click();
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("context menu"),
    );
    assert.equal(await page.evaluate(() => document.activeElement.id), "open-report");
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => {
        window.copiedReportLink = text;
      };
    });
    for (const template of [
      "treemap",
      "sunburst",
      "flamegraph",
      "network",
      "treemap-3d",
      "treemap-v2",
    ]) {
      await page.locator(`input[name="template"][value="${template}"]`).check();
      const url = await readyLink(page);
      assert.equal(new URL(url).pathname, mount + template + "/");
      // Headless Firefox/WebKit may lack WebGL; their 3D page still exercises the empty-state path.
      const destination =
        name !== "chromium" && template === "treemap-3d"
          ? base + template + "/#" + (await encodeFragment({ data: empty }))
          : url;
      const report = await context.newPage();
      await report.goto(destination);
      await readyReport(report);
      if (!(name !== "chromium" && template === "treemap-3d"))
        await report.locator("main svg, main canvas").first().waitFor({ state: "attached" });
      await report.setViewportSize({ width: 960, height: 720 });
      assert.equal(await report.locator("main").getAttribute("data-viewer-state"), "ready");
      if (template === "network") {
        const [entryUid, entryMeta] = Object.entries(data.nodeMetas).find(
          ([, meta]) => meta.isEntry,
        );
        const otherUid = Object.keys(data.nodeMetas).find((uid) => uid !== entryUid);
        const entry = report.locator(`.node[data-uid="${entryUid}"]`);
        const other = report.locator(`.node[data-uid="${otherUid}"]`);
        const rings = report.locator(".network .entry-point-ring");
        assert.equal(await rings.count(), 1);
        assert.equal(await report.locator(".network-legend").count(), 0);
        assert.match(await entry.getAttribute("aria-label"), /Entry point/);
        await entry.hover();
        assert.match(
          await report.locator(".tooltip:not(.tooltip-hidden)").innerText(),
          /Entry point/,
        );
        await other.hover();
        assert.doesNotMatch(
          await report.locator(".tooltip:not(.tooltip-hidden)").innerText(),
          /Entry point/,
        );
        const radius = await entry.getAttribute("r");
        await entry.click();
        assert.equal(await entry.getAttribute("stroke-width"), "3");
        const ringGap = () =>
          entry.evaluate((node) => {
            const ring = document.querySelector(
              `.entry-point-ring[data-uid="${node.dataset.uid}"]`,
            );
            const scale = node.getScreenCTM().a;
            return (
              (node.r.baseVal.value -
                ring.r.baseVal.value -
                Number(node.getAttribute("stroke-width")) / 2 -
                Number(getComputedStyle(ring).strokeWidth.replace("px", "")) / 2) *
              scale
            );
          });
        // Measure the visible separation in CSS pixels, including the selected outline.
        const selectedGap = await ringGap();
        assert(selectedGap > 0);
        await report.getByRole("button", { name: "Zoom out", exact: true }).click();
        assert((await ringGap()) > 0);
        assert((await ringGap()) < selectedGap);
        assert.equal(await entry.getAttribute("r"), radius);
        await entry.dblclick();
        assert.equal(await rings.count(), 0);
        await report.locator(".network-menu summary").click();
        await report.getByRole("button", { name: "Restore hidden (1)", exact: true }).click();
        assert.equal(await rings.count(), 1);
        assert.equal(await entry.getAttribute("aria-label"), `${entryMeta.id} (Entry point)`);
        if (captureScreenshots) {
          await report.screenshot({
            path: path.join(process.env.VIEWER_SCREENSHOT_DIR, `${name}-network.png`),
          });
        }
      }
      if (template === "treemap-v2") {
        await report.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const target = report.locator(".tmv2-node[data-module-id]").first();
        // SVG geometry excludes the selection outline, whose thicker stroke
        // legitimately changes its painted bounding box by one CSS pixel.
        const readShape = (node) => {
          const box = node.querySelector("rect").getBBox();
          return {
            transform: node.getAttribute("transform"),
            width: box.width,
            height: box.height,
          };
        };
        const shape = await target.evaluate(readShape);
        await target.click({ position: { x: 5, y: 5 } });
        assert(await report.locator(".tmv2-id").textContent());
        assert.deepEqual(await target.evaluate(readShape), shape);
        await report.setViewportSize({ width: 1100, height: 760 });
        assert(await report.locator(".tmv2-id").textContent());
      }
      await report.close();
    }
    // Changing controls clears stale results synchronously, before a replacement worker replies.
    assert(
      await page.evaluate(() => {
        const radio = document.querySelector('input[name="template"][value="network"]');
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        return (
          document.querySelector("#result").hidden &&
          !document.querySelector("#open-report").hasAttribute("href")
        );
      }),
    );
    await readyLink(page);
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/assets/load.worker.js", async (route) => {
      await gate;
      await route.continue().catch(() => {});
    });
    await page.locator("#report-file").setInputFiles(jsonFile);
    await page.locator("#cancel").click();
    release();
    await page.unroute("**/assets/load.worker.js");
    assert(await page.locator("#result").isHidden());
    assert.match(await page.locator("#status").innerText(), /Cancelled/);
    await page.locator("#generate").click();
    await readyLink(page);

    for (const [buffer, expected] of [
      [Buffer.from("{"), /JSON/],
      [Buffer.from([255]), /UTF-8/],
    ]) {
      await page.locator("#report-file").setInputFiles({ ...jsonFile, buffer });
      await page.waitForFunction(
        () => document.querySelector("#report-form").getAttribute("aria-busy") === "false",
      );
      assert.match(await page.locator("#status").innerText(), expected);
      assert(await page.locator("#result").isHidden());
    }
    const hugeFile = path.join(temp, "over-budget.json"),
      handle = await fs.open(hugeFile, "w");
    await handle.truncate(64 * 1024 * 1024 + 1);
    await handle.close();
    await page.locator("#report-file").setInputFiles(hugeFile);
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("limit"),
    );
    assert(await page.locator("#result").isHidden());

    // A large, valid JSON value must still produce its complete URL beyond GitHub's limit.
    const entropy = Array.from(
      { length: 12_000 },
      (_, i) => `${i.toString(36)}-${Math.imul(i, 2654435761) >>> 0}`,
    ).join("/");
    const large = { ...data, env: { ...data.env, note: entropy } };
    await page
      .locator("#report-file")
      .setInputFiles({ ...jsonFile, buffer: Buffer.from(JSON.stringify(large)) });
    const long = await readyLink(page);
    assert(long.length > 32_768);
    assert.equal((await decodeFragment(new URL(long).hash)).data.env.note, entropy);
    const longReport = await context.newPage();
    await longReport.goto(long);
    await readyReport(longReport);
    await longReport.close();
    // Exercise record/edge-heavy reports in the actual worker, separately from chart layout.
    const records = Number(process.env.VIEWER_STRESS_RECORDS ?? 10_000);
    assert(Number.isSafeInteger(records) && records > 0 && records <= 200_000);
    const stress = { ...empty, tree: { name: "root", children: [] }, nodeMetas: {}, nodeParts: {} };
    for (let i = 0; i < records; i++) {
      const uid = `stress-m-${i}`,
        part = `stress-p-${i}`;
      stress.nodeMetas[uid] = {
        id: `/src/目录😀/module-${i}.js`,
        moduleParts: { "main.js": part },
        imported: i ? [{ uid: `stress-m-${i - 1}` }] : [],
        importedBy: i + 1 < records ? [{ uid: `stress-m-${i + 1}` }] : [],
      };
      stress.nodeParts[part] = {
        metaUid: uid,
        renderedLength: i + 1,
        gzipLength: 0,
        brotliLength: 0,
      };
      stress.tree.children.push({ name: `module-${i}.js`, uid: part });
    }
    const stressJson = Buffer.from(JSON.stringify(stress)),
      started = performance.now();
    const stressFile = path.join(temp, "stress.json");
    await fs.writeFile(stressFile, stressJson);
    await page.locator("#report-file").setInputFiles(stressFile);
    const stressUrl = await readyLink(page),
      encodedMs = performance.now() - started;
    const summary = await page.evaluate(async (fragment) => {
      const started = performance.now();
      const worker = new Worker(new URL("./assets/load.worker.js", location.href), {
        type: "module",
      });
      try {
        const report = await new Promise((resolve, reject) => {
          worker.addEventListener("message", ({ data }) => {
            if (data.type === "decoded") resolve(data.report);
            else if (data.type === "error") reject(new Error(data.message));
          });
          worker.addEventListener("error", reject);
          worker.postMessage({ type: "decode", fragment });
        });
        return {
          modules: Object.keys(report.data.nodeMetas).length,
          parts: Object.keys(report.data.nodeParts).length,
          children: report.data.tree.children.length,
          last: report.data.nodeMetas[`stress-m-${Object.keys(report.data.nodeMetas).length - 1}`]
            .id,
          decodeMs: performance.now() - started,
        };
      } finally {
        worker.terminate();
      }
    }, new URL(stressUrl).hash);
    assert.equal(summary.modules, records);
    assert.equal(summary.parts, records);
    assert.equal(summary.children, records);
    assert.equal(summary.last, `/src/目录😀/module-${records - 1}.js`);
    assert.deepEqual((await decodeFragment(new URL(stressUrl).hash)).data, stress);
    console.log(
      `${name} stress: ${JSON.stringify({ records, jsonBytes: stressJson.length, urlCharacters: stressUrl.length, encodeMs: Math.round(encodedMs), decodeMs: Math.round(summary.decodeMs) })}`,
    );
    if (captureScreenshots) {
      await page.locator("#report-file").setInputFiles(jsonFile);
      await readyLink(page);
    }
    // Firefox's URL.hash setter may silently discard very large fragments. Generation must
    // preserve the entire payload even when a browser cannot navigate to an oversized URL.
    const veryLongNote = Array.from(
      { length: 180_000 },
      (_, i) => `${i.toString(36)}-${Math.imul(i, 2654435761) >>> 0}`,
    ).join("/");
    await page.locator("#report-file").setInputFiles({
      ...jsonFile,
      buffer: Buffer.from(JSON.stringify({ ...data, env: { note: veryLongNote } })),
    });
    const veryLong = await readyLink(page);
    assert(veryLong.length > 1_048_576);
    await page.locator("#copy-link").click();
    await page.waitForFunction(() =>
      document.querySelector("#status").textContent.includes("copied"),
    );
    assert.equal(await page.evaluate(() => window.copiedReportLink), veryLong);
    assert.equal(
      (await decodeFragment(veryLong.slice(veryLong.indexOf("#")))).data.env.note,
      veryLongNote,
    );
    const frozen = JSON.parse(
      await fs.readFile(new URL("../test/fixtures/share/v1.json", import.meta.url), "utf8"),
    );
    const oldReport = await context.newPage();
    await oldReport.goto(base + "network/#" + frozen.fragment);
    await readyReport(oldReport);
    assert.equal(await oldReport.title(), frozen.title);
    await oldReport.close();
    const broken = await context.newPage();
    await broken.goto(base + "network/#2.AA");
    await broken.waitForSelector('main[data-viewer-state="error"]');
    assert.match(await broken.locator("main").innerText(), /newer viewer/);
    await broken.close();
    const missing = await context.newPage();
    await missing.goto(base + "network/");
    await missing.waitForSelector('main[data-viewer-state="error"]');
    assert.match(await missing.locator("main").innerText(), /no report data/);
    await missing.close();
    const state = await context.storageState({ indexedDB: true });
    assert.deepEqual(state.cookies, []);
    assert(
      state.origins.every(
        (entry) => entry.localStorage.length === 0 && (entry.indexedDB ?? []).length === 0,
      ),
    );
    assert.equal(await page.evaluate(() => sessionStorage.length), 0);
    assert.deepEqual(external, []);
    if (captureScreenshots) {
      await page.locator("#report-file").setInputFiles(jsonFile);
      await readyLink(page);
      await fs.mkdir(process.env.VIEWER_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.VIEWER_SCREENSHOT_DIR, `${name}-index.png`),
      });
    }
    assert.deepEqual(errors, []);
    console.log(
      `${name}: file-to-link, templates, keyboard, clipboard, resize, cancellation, stale results, invalid input, long fragments and local-only processing passed`,
    );
    if (memoryTimer) {
      await sampleRss();
      console.log(`${name} sampled process-tree peak RSS bytes: ${peakRssBytes}`);
    }
    await context.close();
    await browser.close();
    browser = undefined;
  }
  assert(
    requests.every(
      (req) => req.method === "GET" && !req.url.includes("?") && !req.url.includes("#"),
    ),
  );
} finally {
  clearInterval(memoryTimer);
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(temp, { recursive: true, force: true });
}
