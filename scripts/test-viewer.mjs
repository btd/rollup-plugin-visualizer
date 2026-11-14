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
    peakRssBytes = 0;
    browser = await engines[name].launch({
      headless: true,
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
    assert.equal(await page.locator("svg, canvas").count(), 0);
    await page.locator("#report-file").setInputFiles(jsonFile);
    const first = await readyLink(page);
    assert.equal(page.url(), base);
    assert.equal(context.pages().length, 1);
    assert.deepEqual((await decodeFragment(new URL(first).hash)).data, data);
    await page.evaluate((json) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([json], "dropped.json", { type: "application/json" }));
      document
        .querySelector("#drop-target")
        .dispatchEvent(
          new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
        );
    }, jsonFile.buffer.toString("utf8"));
    assert.deepEqual((await decodeFragment(new URL(await readyLink(page)).hash)).data, data);
    assert.equal(await page.locator("#file-name").innerText(), "dropped.json");
    await page.locator("#copy-link").click();
    await page.waitForFunction(() =>
      /copied|selected/.test(document.querySelector("#status").textContent),
    );
    assert.equal(await page.locator("#report-url").inputValue(), first);
    for (const template of ["treemap", "sunburst", "flamegraph", "network", "treemap-3d"]) {
      await page.locator("#template").selectOption(template);
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
      assert.equal(await report.locator('input[type="file"], #template').count(), 0);
      if (!(name !== "chromium" && template === "treemap-3d"))
        await report.locator("main svg, main canvas").first().waitFor({ state: "attached" });
      await report.setViewportSize({ width: 960, height: 720 });
      assert.equal(await report.locator("main").getAttribute("data-viewer-state"), "ready");
      await report.close();
    }
    // Changing controls clears stale results synchronously, before a replacement worker replies.
    assert(
      await page.evaluate(() => {
        const select = document.querySelector("#template");
        select.value = "network";
        select.dispatchEvent(new Event("change"));
        return (
          document.querySelector("#result").hidden &&
          document.querySelector("#report-url").value === ""
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
    if (process.env.VIEWER_SCREENSHOT_DIR) {
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
    assert.equal(await page.locator("#report-url").inputValue(), veryLong);
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
    assert.deepEqual(errors, []);
    if (process.env.VIEWER_SCREENSHOT_DIR) {
      await page.locator("#report-file").setInputFiles(jsonFile);
      await readyLink(page);
      await fs.mkdir(process.env.VIEWER_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.VIEWER_SCREENSHOT_DIR, `${name}-index.png`),
      });
    }
    console.log(
      `${name}: file-to-link, templates, resize, cancellation, stale results, invalid input, long fragments and local-only processing passed`,
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
