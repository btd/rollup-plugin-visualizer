import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { rollup } from "rollup";
import { SourceMapGenerator } from "source-map";
import { visualizer } from "../dist/plugin/index.js";
import { encodeFragment } from "../dist/shared/share/transport.js";

const prefix = "/inspector/",
  entry = prefix + "src/入口😀.js";
const longId =
  "src/features/地域別レポート😀/" +
  "customer-workspaces/".repeat(7) +
  "café spaces/%literal/RevenueChart.js";
const files = {
  [prefix + "node_modules/pkg/index.js"]: "export { value } from './impl.js';",
  [prefix + "node_modules/pkg/impl.js"]:
    "import { helper } from './helper.js'; export const value = helper + " +
    JSON.stringify("representative output contribution ".repeat(3000)) +
    ";",
  [prefix + "node_modules/pkg/helper.js"]: "export const helper = Math.random();",
  [prefix + "node_modules/parent/node_modules/pkg/impl.js"]: "export const value = Math.random();",
  [prefix + longId]:
    "import { value } from " +
    JSON.stringify(prefix + "node_modules/pkg/impl.js") +
    "; export const long = () => value;",
  [prefix + "src/RevenueChart.js"]: "export const duplicate = Math.random();",
  [prefix + "src/tiny.js"]: "export const tiny = Math.random();",
  [prefix + "src/cycle-a.js"]:
    "import { b } from './cycle-b.js'; export function a() { return b; }",
  [prefix + "src/cycle-b.js"]: "import { a } from './cycle-a.js'; export const b = () => a;",
  [prefix + "src/self.js"]:
    "import { self as same } from './self.js'; export function self() { return same; }",
};
for (let i = 0; i < 60; i++)
  files[prefix + `node_modules/pkg/internal-${i}.js`] = `export const inner${i} = Math.random();`;
files[prefix + "node_modules/pkg/impl.js"] =
  Array.from({ length: 60 }, (_, i) => `import { inner${i} } from './internal-${i}.js';`).join(
    "\n",
  ) +
  "\n" +
  files[prefix + "node_modules/pkg/impl.js"].replace(
    "helper + ",
    "helper + " + Array.from({ length: 60 }, (_, i) => `inner${i}`).join(" + ") + " + ",
  );
for (let i = 0; i < 300; i++)
  files[prefix + `src/routes/route-${String(i).padStart(3, "0")}.js`] =
    `import { value } from '../../node_modules/pkg/impl.js'; export const read = () => value + ${i};`;
files[entry] =
  Array.from(
    { length: 300 },
    (_, i) => `import {read as r${i}} from './routes/route-${String(i).padStart(3, "0")}.js';`,
  ).join("\n") +
  `\nimport { value } from '../node_modules/pkg/index.js';
  import { value as copy } from '../node_modules/parent/node_modules/pkg/impl.js';
  import { long } from ${JSON.stringify(prefix + longId)};
  import { duplicate } from './RevenueChart.js'; import { tiny } from './tiny.js';
  import { a } from './cycle-a.js'; import { self } from './self.js'; import external from 'external-dep'; console.log(self);
  console.log(value, copy, long(), duplicate, tiny, a, external, ${Array.from({ length: 300 }, (_, i) => `r${i}()`).join(",")});
  import('../node_modules/pkg/impl.js').then(console.log);`;

const bundle = await rollup({
  input: entry,
  external: ["external-dep"],
  onwarn: (warning) => {
    if (warning.code !== "CIRCULAR_DEPENDENCY") console.error(warning.message);
  },
  plugins: [
    {
      name: "inspector-fixture",
      resolveId(id, importer) {
        const resolved = id.startsWith(".")
          ? path.posix.resolve(path.posix.dirname(importer), id)
          : id;
        return resolved in files ? resolved : null;
      },
      load: (id) => files[id],
    },
    ...["raw-data", "treemap-v2", "treemap"].map((template) =>
      visualizer({
        template,
        emitFile: true,
        filename: `${template}.report`,
        projectRoot: prefix,
        sourcemap: true,
      }),
    ),
    visualizer({
      emitFile: true,
      filename: "default.report",
      projectRoot: prefix,
      sourcemap: true,
    }),
  ],
});
const generated = await bundle.generate({
  format: "es",
  sourcemap: true,
  entryFileNames: "app.js",
});
await bundle.close();
const asset = (name) =>
  generated.output.find((file) => file.type === "asset" && file.fileName === `${name}.report`)
    .source;
const data = JSON.parse(asset("raw-data"));
assert.equal(
  asset("default"),
  asset("treemap"),
  "omitting the template must retain the original treemap",
);
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "treemap-v2-"));
await fs.writeFile(path.join(directory, "report.html"), asset("treemap-v2"));
await fs.writeFile(path.join(directory, "legacy.html"), asset("treemap"));
await fs.writeFile(path.join(directory, "report.json"), JSON.stringify(data));
const cli = spawnSync(
  process.execPath,
  [path.resolve("dist/bin/cli.js"), "--template=treemap-v2", "--filename=cli.html", "report.json"],
  { cwd: directory, encoding: "utf8" },
);
assert.equal(cli.status, 0, cli.stderr);
const left = prefix + "left.js",
  right = prefix + "right.js",
  shared = prefix + "shared😀.js";
const multiple = await rollup({
  input: { left, right },
  plugins: [
    {
      name: "multiple-occurrences",
      resolveId: (id) => id,
      load(id) {
        if (id === shared) return "export const unused = 0;";
        const map = new SourceMapGenerator({ file: id });
        map.addMapping({
          generated: { line: 1, column: 0 },
          original: { line: 1, column: 0 },
          source: shared,
        });
        map.addMapping({
          generated: { line: 2, column: 0 },
          original: { line: 1, column: 0 },
          source: shared,
        });
        map.setSourceContent(shared, "export const unused = 0;");
        const call = id === left ? "console.log('left😀');" : "console.log('right😀', 123456);";
        return {
          code: `import { unused } from ${JSON.stringify(shared)};\n` + call,
          map: map.toJSON(),
        };
      },
    },
    visualizer({
      template: "treemap-v2",
      emitFile: true,
      filename: "multiple.html",
      projectRoot: prefix,
      sourcemap: true,
    }),
  ],
});
const multipleOutput = await multiple.generate({
  format: "es",
  sourcemap: true,
  entryFileNames: "[name].js",
});
await multiple.close();
await fs.writeFile(
  path.join(directory, "multiple.html"),
  multipleOutput.output.find((file) => file.type === "asset" && file.fileName === "multiple.html")
    .source,
);
const metricFiles = {
  "/metrics/entry.js":
    "import { value } from './value.js'; console.log(value); import('./empty.js').then(console.log);",
  "/metrics/value.js":
    "export const value = " +
    JSON.stringify("compressible representative module ".repeat(200)) +
    ";",
  "/metrics/empty.js": "export {};",
};
const metricBundle = await rollup({
  input: "/metrics/entry.js",
  onwarn: (warning) => {
    if (warning.code !== "EMPTY_BUNDLE") console.error(warning.message);
  },
  plugins: [
    {
      name: "metric-fixture",
      resolveId(id, importer) {
        return id.startsWith(".") ? path.posix.resolve(path.posix.dirname(importer), id) : id;
      },
      load: (id) => metricFiles[id],
    },
    visualizer({
      template: "treemap-v2",
      emitFile: true,
      filename: "metrics.html",
      projectRoot: "/metrics/",
      gzipSize: true,
      brotliSize: true,
    }),
    visualizer({
      template: "raw-data",
      emitFile: true,
      filename: "metrics.json",
      projectRoot: "/metrics/",
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
const metricOutput = await metricBundle.generate({ format: "es", entryFileNames: "app.js" });
await metricBundle.close();
for (const name of ["metrics.html", "metrics.json"])
  await fs.writeFile(
    path.join(directory, name),
    metricOutput.output.find((file) => file.type === "asset" && file.fileName === name).source,
  );
const mixedCli = spawnSync(
  process.execPath,
  [
    path.resolve("dist/bin/cli.js"),
    "--template=treemap-v2",
    "--filename=mixed.html",
    "metrics.json",
    "report.json",
  ],
  { cwd: directory, encoding: "utf8" },
);
assert.equal(mixedCli.status, 0, mixedCli.stderr);
const isolatedBundle = await rollup({
  input: "\0virtual-地域\0entry.js",
  plugins: [
    {
      name: "isolated-module",
      resolveId: (id) => id,
      load: () => 'console.log("no dependencies");',
    },
    ...["treemap-v2", "list", "markdown"].map((template) =>
      visualizer({
        template,
        emitFile: true,
        filename: template === "treemap-v2" ? "isolated.html" : template,
        projectRoot: "/isolated/",
      }),
    ),
  ],
});
const isolatedOutput = await isolatedBundle.generate({ format: "es" });
await isolatedBundle.close();
for (const format of ["list", "markdown"]) {
  const text = isolatedOutput.output.find((file) => file.fileName === format).source;
  assert(text.includes(String.raw`\0virtual-地域\0entry.js`));
  assert(!text.includes("\0"));
}
await fs.writeFile(
  path.join(directory, "isolated.html"),
  isolatedOutput.output.find((file) => file.type === "asset" && file.fileName === "isolated.html")
    .source,
);
const viewer = path.resolve("dist/viewer");
const server = http.createServer(async (request, response) => {
  try {
    const relative = new URL(request.url, "http://localhost").pathname.slice(1);
    if (relative === "favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    const root = relative.startsWith("viewer/") ? viewer : directory;
    const requested = relative.startsWith("viewer/") ? relative.slice(7) : relative;
    const file = path.resolve(
      root,
      requested + (requested.endsWith("/") || !requested ? "index.html" : ""),
    );
    assert(file.startsWith(root + path.sep));
    response.setHeader(
      "Content-Type",
      { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" }[path.extname(file)] ??
        "application/octet-stream",
    );
    response.end(await fs.readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [],
  requests = [];
const settle = (page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
const geometry = (page) =>
  page
    .locator(".tmv2-node")
    .evaluateAll((nodes) =>
      nodes.map((node) => [
        node.dataset.outputKey,
        node.getAttribute("transform"),
        node.querySelector("rect").getAttribute("width"),
        node.querySelector("rect").getAttribute("height"),
      ]),
    );
const rendering = (page) =>
  page.locator("svg .node, svg .tmv2-node").evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const rect = node.querySelector("rect"),
          text = node.querySelector("text");
        return {
          name: text?.textContent,
          transform: node.getAttribute("transform"),
          width: rect.getAttribute("width"),
          height: rect.getAttribute("height"),
          radius: rect.getAttribute("rx"),
          fill: rect.getAttribute("fill"),
          textColor: text?.getAttribute("fill"),
          textSize: text?.getAttribute("font-size"),
          textAnchor: text?.getAttribute("text-anchor"),
          textTransform: text?.getAttribute("transform"),
          textX: Number(text?.getAttribute("x")),
          textY: Number(text?.getAttribute("y")),
          computedTextSize: text && getComputedStyle(text).fontSize,
        };
      })
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
const assertRendering = async (actualPage, originalPage, message) => {
  const actual = await rendering(actualPage),
    expected = await rendering(originalPage);
  assert.equal(actual.length, expected.length, message + ": visible node count");
  for (let index = 0; index < expected.length; index++) {
    const { textX: actualX, textY: actualY, ...actualNode } = actual[index];
    const { textX: expectedX, textY: expectedY, ...expectedNode } = expected[index];
    assert.deepEqual(actualNode, expectedNode, message + ": " + expectedNode.name);
    // Text bounding boxes vary slightly with page position. With matching viewBox
    // and plot dimensions, 0.01 unscaled SVG units is at most 0.01 CSS pixels.
    assert(Math.abs(actualX - expectedX) < 0.01, message + ": label x position");
    assert(Math.abs(actualY - expectedY) < 0.01, message + ": label y position");
  }
};
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  context.on("page", (page) => {
    page.setDefaultTimeout(7000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (request.url().startsWith("http") && !request.url().startsWith(origin + "/"))
        requests.push(request.url());
    });
  });
  for (const url of [
    origin + "/report.html",
    origin + "/cli.html",
    origin + "/viewer/treemap-v2/#" + (await encodeFragment({ data })),
  ]) {
    const page = await context.newPage();
    await page.goto(url);
    await page.locator(".treemap-v2 svg .tmv2-node").first().waitFor();
    await settle(page);
    if (new URL(url).pathname === "/report.html") {
      const bounds = await page.locator(".tmv2-plot").boundingBox();
      const original = await context.newPage();
      await original.goto(origin + "/legacy.html");
      await original.evaluate(
        ({ data, width, height }) => {
          const main = document.querySelector("main"),
            style = getComputedStyle(main);
          main.style.flex = "none";
          main.style.width = `${width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)}px`;
          main.style.height = `${height + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)}px`;
          globalThis.drawChart.default(main, data, width, height);
        },
        { data, width: bounds.width, height: bounds.height },
      );
      await settle(original);
      await assertRendering(
        page,
        original,
        "v2 must use the original treemap geometry, palette, rounded rectangles, and label styling",
      );
      await page.locator("#module-filter-exclude").fill("**/pkg/impl.js");
      await original.locator("#module-filter-exclude").fill("**/pkg/impl.js");
      await page.waitForFunction(
        () =>
          ![...document.querySelectorAll(".tmv2-node")].some(
            (node) => node.dataset.moduleId === "node_modules/pkg/impl.js",
          ),
      );
      await original.waitForFunction(
        () =>
          ![...document.querySelectorAll("svg .node text")].some(
            (node) => node.textContent === "impl.js",
          ),
      );
      await settle(page);
      await settle(original);
      await assertRendering(
        page,
        original,
        "filter changes must retain original resquarify tiling and colors",
      );
      await page.locator("#module-filter-exclude").fill("");
      await original.locator("#module-filter-exclude").fill("");
      await page.locator('.tmv2-node[data-module-id="node_modules/pkg/impl.js"]').waitFor();
      await original
        .locator("svg .node")
        .filter({ has: original.locator("text").filter({ hasText: /^impl\.js$/ }) })
        .waitFor();
      await settle(page);
      await settle(original);
      await assertRendering(
        page,
        original,
        "restoring chart visibility must retain the original layout",
      );
      await original.close();
    }
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "All files");
    assert(await page.getByRole("button", { name: "Clear selection", exact: true }).isDisabled());
    assert.equal(await page.locator(".tmv2-node.is-selected").count(), 0);
    assert.equal(await page.locator(".tmv2-list-scope").count(), 0);
    assert.equal(
      await page.locator(".size-selectors input").count(),
      0,
      "unavailable compressed metrics must not appear",
    );
    await page
      .locator('.tmv2-node[data-module-id="src/入口😀.js"]')
      .click({ position: { x: 5, y: 5 } });
    assert.equal(await page.getByRole("button", { name: /^Imported by / }).count(), 0);
    assert.equal(
      await page.getByRole("button", { name: /^Imports / }).getAttribute("aria-pressed"),
      "true",
      "a file with no importers must show its nonempty Imports section",
    );
    await page
      .locator(".tmv2-row")
      .filter({
        has: page.getByText("node_modules/pkg/impl.js", { exact: true }),
      })
      .first()
      .click();
    assert.equal(
      await page.getByRole("button", { name: /^Imports / }).getAttribute("aria-pressed"),
      "true",
      "following an import must keep the visible Imports direction",
    );
    assert.equal(
      await page.locator(".tmv2-list .tmv2-row").first().locator(".tmv2-path").count(),
      1,
    );
    const group = page
      .locator('.tmv2-node[data-group="true"]')
      .filter({ hasText: /^pkg$/ })
      .first();
    const groupColor = await group.locator("rect").getAttribute("fill");
    await group.click({ position: { x: 8, y: 8 } });
    assert.match(await page.locator(".tmv2-kind").innerText(), /Output group/);
    assert.equal(await page.getByRole("button", { name: /^Imports / }).count(), 0);
    assert.equal(
      await page.getByRole("button", { name: /^Imported by / }).getAttribute("aria-pressed"),
      "true",
      "navigation must choose a nonempty section when the previously used tab is absent",
    );
    await page.getByRole("button", { name: /^Files / }).click();
    assert(await page.locator(".tmv2-internal summary").isVisible());
    await page.getByRole("button", { name: /^Imported by / }).click();
    await page.getByRole("searchbox").fill("no-such-file-in-report");
    assert.match(await page.locator(".tmv2-list").innerText(), /No matching paths/);
    assert(await page.getByRole("button", { name: /^Imported by / }).isVisible());
    await page.getByRole("searchbox").fill("");
    const correctionNode = page.locator('.tmv2-node[data-module-id="node_modules/pkg/impl.js"]');
    const correctionBox = await correctionNode.boundingBox();
    const correctionGeometry = await geometry(page);
    await page.mouse.click(correctionBox.x + 8, correctionBox.y - 3);
    // Nearby corrective clicks may carry the browser's double-click count.
    await page.mouse.click(correctionBox.x + 8, correctionBox.y + 1, { clickCount: 2 });
    assert.equal(await page.locator(".tmv2-id").textContent(), "node_modules/pkg/impl.js");
    assert.deepEqual(
      await geometry(page),
      correctionGeometry,
      "a quick correction to a neighboring file must select it without zooming",
    );
    await group.dblclick({ position: { x: 8, y: 8 } });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".tmv2-chart-navigation nav button")].at(-1).textContent ===
        "pkg",
    );
    assert.equal(
      await group.locator("rect").getAttribute("fill"),
      groupColor,
      "deliberate zoom must preserve the selected package's original report color",
    );
    assert.equal(
      await page
        .locator(".tmv2-inspector-header")
        .getByRole("button", { name: "Undo zoom", exact: true })
        .count(),
      1,
      "the existing selection action switches to Undo zoom",
    );
    assert.equal(
      await page
        .locator(".tmv2-chart-navigation")
        .getByRole("button", { name: "Undo zoom", exact: true })
        .count(),
      0,
    );
    await page.getByRole("button", { name: "Undo zoom", exact: true }).click();
    assert.equal(
      await page.locator(".tmv2-id").textContent(),
      "node_modules/pkg/impl.js",
      "undoing double-click zoom restores the panel from before its first click",
    );
    await group.dblclick({ position: { x: 8, y: 8 } });
    await page.getByRole("button", { name: "app.js", exact: true }).click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "app.js");
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "All files");
    await settle(page);
    await page.getByRole("searchbox").fill("ROUTE-");
    await page.locator(".tmv2-list").hover();
    await page.mouse.wheel(0, 1400);
    await page.waitForFunction(() => document.querySelector(".tmv2-list").scrollTop > 100);
    const hiddenPanelScroll = await page
      .locator(".tmv2-list")
      .evaluate((element) => element.scrollTop);
    await page.getByRole("button", { name: "Hide details", exact: true }).click();
    await settle(page);
    const hiddenGroup = await group.boundingBox();
    // Use the right edge: opening details moves this group away from the pointer.
    await page.mouse.dblclick(hiddenGroup.x + hiddenGroup.width - 8, hiddenGroup.y + 8, {
      delay: 150,
    });
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".tmv2-chart-navigation nav button")].at(-1).textContent ===
        "pkg",
    );
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "pkg");
    await page.getByRole("button", { name: "Undo zoom", exact: true }).click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "All files");
    assert.equal(await page.getByRole("searchbox").inputValue(), "ROUTE-");
    assert.equal(
      await page.locator(".tmv2-list").evaluate((element) => element.scrollTop),
      hiddenPanelScroll,
    );
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await settle(page);
    await group.click({ position: { x: 8, y: 8 } });
    await page.getByRole("button", { name: /^Imported by / }).click();
    const groupMeasurement = await page.locator(".tmv2-measurement").innerText();
    await page.locator("#module-filter-exclude").fill("**/pkg/impl.js");
    await page.waitForFunction(() =>
      document.querySelector(".tmv2-availability").textContent.includes("hidden"),
    );
    assert.equal(
      await page.locator(".tmv2-measurement").innerText(),
      groupMeasurement,
      "partial visibility must not change held group measurements or their denominator",
    );
    assert(
      !(await page.getByRole("button", { name: "Zoom to selection", exact: true }).isDisabled()),
    );
    await page.locator("#module-filter-exclude").fill("");
    await page.waitForFunction(
      () => !document.querySelector(".tmv2-availability").textContent.includes("hidden"),
    );
    await settle(page);
    const before = await geometry(page);
    assert.equal(
      await page.locator(".tmv2-internal-row").count(),
      0,
      "collapsed internal relationships must not allocate row DOM",
    );
    const internal = page.locator(".tmv2-internal");
    await internal.locator("summary").click();
    await page.locator(".tmv2-internal-row").first().waitFor();
    const hoveredRelationship = page.locator(".tmv2-internal-row").first();
    const externalRowPadding = await page
      .locator(".tmv2-list .tmv2-row")
      .first()
      .evaluate((row) => getComputedStyle(row).padding);
    assert.equal(
      await hoveredRelationship.evaluate((row) => getComputedStyle(row).padding),
      externalRowPadding,
    );
    const primaryPath = await hoveredRelationship.locator(".tmv2-path").first().boundingBox();
    const secondaryPath = await hoveredRelationship.locator(".tmv2-path").last().boundingBox();
    assert.equal(primaryPath.x, secondaryPath.x);
    assert.equal(primaryPath.width, secondaryPath.width);
    assert(
      secondaryPath.y >= primaryPath.y + primaryPath.height,
      "both relationship types use full-width stacked endpoint paths in one row",
    );
    await hoveredRelationship.locator("button").first().hover();
    const relationshipHover = await hoveredRelationship.evaluate(
      (row) => getComputedStyle(row).backgroundColor,
    );
    assert.notEqual(relationshipHover, "rgba(0, 0, 0, 0)");
    await hoveredRelationship.locator("button").last().hover();
    assert.equal(
      await hoveredRelationship.evaluate((row) => getComputedStyle(row).backgroundColor),
      relationshipHover,
    );
    assert.equal(
      await hoveredRelationship.locator("button").count(),
      2,
      "one relationship has two navigable endpoints inside one shared hover area",
    );
    await internal.hover();
    await page.mouse.wheel(0, 700);
    await page.waitForFunction(() => document.querySelector(".tmv2-internal").scrollTop > 100);
    const savedInternalScroll = await internal.evaluate((element) => element.scrollTop);
    await page.getByRole("button", { name: "Zoom to selection", exact: true }).click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "pkg");
    assert.equal(
      await page.getByRole("button", { name: /^Files / }).getAttribute("aria-pressed"),
      "true",
    );
    await page.getByRole("button", { name: "Hide details", exact: true }).click();
    assert(await page.getByRole("complementary", { name: "Dependency details" }).isHidden());
    await page.getByRole("button", { name: "Show details", exact: true }).click();
    await page.getByRole("button", { name: "Undo zoom", exact: true }).click();
    assert.equal(
      await page.getByRole("button", { name: /^Imported by / }).getAttribute("aria-pressed"),
      "true",
    );
    assert(await internal.evaluate((element) => element.open));
    assert.equal(await internal.evaluate((element) => element.scrollTop), savedInternalScroll);
    const internalRow = await internal.evaluate((element) =>
      [...element.querySelectorAll(".tmv2-internal-row")].findIndex((row) => {
        const bounds = row.getBoundingClientRect(),
          container = element.getBoundingClientRect();
        return bounds.top >= container.top && bounds.bottom <= container.bottom;
      }),
    );
    assert(internalRow >= 0);
    await page.locator(".tmv2-internal-row").nth(internalRow).locator("button").first().click();
    assert.deepEqual(
      await geometry(page),
      before,
      "following an internal relationship must not relayout",
    );
    await group.click({ position: { x: 8, y: 8 } });
    assert.equal(await page.locator(".tmv2-internal-row").count(), 0);
    const first = page.locator(".tmv2-row").first();
    assert((await page.locator(".tmv2-row").count()) >= 300);
    await first.click();
    assert.deepEqual(await geometry(page), before, "following a relationship must not relayout");
    await group.click({ position: { x: 8, y: 8 } });
    await page.getByRole("searchbox", { name: "Find a path" }).fill("ROUTE-");
    const list = page.locator(".tmv2-list");
    await list.hover();
    await page.mouse.wheel(0, 1900);
    await page.waitForFunction(() => document.querySelector(".tmv2-list").scrollTop > 100);
    const position = await list.evaluate((element) => element.scrollTop);
    const visibleIndex = await list.evaluate((element) =>
      [...element.children].findIndex((row) => {
        const bounds = row.getBoundingClientRect(),
          list = element.getBoundingClientRect();
        return bounds.top >= list.top && bounds.bottom <= list.bottom;
      }),
    );
    assert(visibleIndex >= 0);
    await page.getByRole("button", { name: /^Imported by / }).click();
    assert.equal(await page.getByRole("searchbox").inputValue(), "ROUTE-");
    assert.equal(await list.evaluate((element) => element.scrollTop), position);
    await page.setViewportSize({ width: 1280, height: 820 });
    await settle(page);
    assert.equal(await page.getByRole("searchbox").inputValue(), "ROUTE-");
    assert.equal(await list.evaluate((element) => element.scrollTop), position);
    assert.match(await page.locator(".tmv2-list-scope").innerText(), /300 of 303 matches/);
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page);
    await page.getByRole("button", { name: "Zoom to selection", exact: true }).click();
    await page.getByRole("searchbox").fill("impl.js");
    await page.locator(".tmv2-row").click();
    await page.getByRole("button", { name: "Zoom to selection", exact: true }).click();
    await page.getByRole("button", { name: "Undo zoom", exact: true }).click();
    assert.equal(await page.locator(".tmv2-id").textContent(), "node_modules/pkg/impl.js");
    assert.equal(
      await page.getByRole("navigation", { name: "Chart location" }).innerText(),
      "Overview / app.js / node_modules / pkg",
    );
    assert(await page.getByRole("button", { name: "Zoom to selection", exact: true }).isEnabled());
    assert.equal(await page.getByRole("button", { name: "Undo zoom", exact: true }).count(), 0);
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    assert(
      await page.getByRole("button", { name: "Undo zoom", exact: true }).isEnabled(),
      "clearing inspection exposes Undo for the current view without a second control",
    );
    await page.locator("#module-filter-exclude").fill("**/pkg/**");
    await page.waitForFunction(() =>
      document.querySelector(".tmv2-availability").textContent.includes("hidden"),
    );
    await page.getByRole("button", { name: "Undo zoom", exact: true }).click();
    assert.equal(await page.getByRole("searchbox").inputValue(), "ROUTE-");
    assert.equal(await list.evaluate((element) => element.scrollTop), position);
    assert.equal(
      await page.locator("#module-filter-exclude").inputValue(),
      "**/pkg/**",
      "undo zoom must retain independently changed chart filters",
    );
    await page.locator("#module-filter-exclude").fill("");
    await page.waitForFunction(
      () => !document.querySelector(".tmv2-availability").textContent.includes("hidden"),
    );
    await page.getByRole("button", { name: /^Files / }).click();
    assert.equal(await page.getByRole("searchbox").inputValue(), "");
    assert.equal(await list.evaluate((element) => element.scrollTop), 0);
    await page.getByRole("button", { name: /^Imported by / }).click();
    await page.getByRole("searchbox").fill("pkg/index.js");
    await page.locator(".tmv2-row").first().click();
    assert.match(await page.locator(".tmv2-kind").innerText(), /Graph-only/);
    assert(await page.getByRole("button", { name: "Zoom to selection", exact: true }).isDisabled());
    assert.equal(
      await page.locator('.tmv2-id[aria-label="Full module ID"]').textContent(),
      "node_modules/pkg/index.js",
    );
    await page.getByRole("button", { name: /^Imports / }).click();
    await page.locator(".tmv2-row").click();
    assert.equal(
      await page.locator('.tmv2-id[aria-label="Full module ID"]').textContent(),
      "node_modules/pkg/impl.js",
    );
    await page.locator("#module-filter-exclude").fill("**/pkg/**");
    await page.waitForFunction(() =>
      document.querySelector(".tmv2-availability").textContent.includes("hidden"),
    );
    assert(await page.getByRole("button", { name: "Zoom to selection", exact: true }).isDisabled());
    assert.equal(
      await page.locator('.tmv2-id[aria-label="Full module ID"]').textContent(),
      "node_modules/pkg/impl.js",
    );
    await page.locator("#module-filter-exclude").fill("");
    await page.waitForFunction(() => !document.querySelector(".tmv2-show-chart").disabled);
    await page.getByRole("button", { name: "Hide details", exact: true }).click();
    await settle(page);
    assert(await page.getByRole("complementary", { name: "Dependency details" }).isHidden());
    const fullWidth = await page.locator(".tmv2-plot").boundingBox();
    await page
      .locator('.tmv2-node[data-group="true"]')
      .first()
      .click({ position: { x: 6, y: 6 } });
    await settle(page);
    assert(await page.getByRole("complementary", { name: "Dependency details" }).isVisible());
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "All files");
    assert((await page.locator(".tmv2-plot").boundingBox()).width < fullWidth.width);
    await page.getByRole("button", { name: /^Files / }).click();
    await page.getByRole("searchbox").fill("tiny.js");
    await page.locator(".tmv2-row").click();
    assert.doesNotMatch(await page.locator(".tmv2-measurement").innerText(), /:\s*0\s*B\b/);
    await page.getByRole("button", { name: "Zoom to selection", exact: true }).click();
    assert.equal(await page.locator(".tmv2-node[data-module-id]").count(), 1);
    const focused = await page.locator(".tmv2-node[data-module-id]").boundingBox();
    assert(focused.width > 200 && focused.height > 100);
    const zoomedGeometry = await geometry(page);
    const zoomedLocation = await page
      .getByRole("navigation", { name: "Chart location" })
      .innerText();
    assert(await page.getByRole("button", { name: "Undo zoom", exact: true }).isEnabled());
    await page.getByRole("button", { name: /^Imported by / }).click();
    await page.locator(".tmv2-row").first().click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "入口😀.js");
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "tiny.js");
    assert.equal(await page.locator(".tmv2-node.is-selected").count(), 0);
    assert.equal(
      await page.getByRole("navigation", { name: "Chart location" }).innerText(),
      zoomedLocation,
    );
    assert.deepEqual(
      await geometry(page),
      zoomedGeometry,
      "clear selection must restore the current view's summary without changing chart geometry",
    );
    await page.getByRole("button", { name: "Undo zoom", exact: true }).click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "tiny.js");
    assert.equal(
      await page.getByRole("navigation", { name: "Chart location" }).innerText(),
      "Overview",
    );
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    assert.equal(await page.locator(".tmv2-identity h2").innerText(), "All files");
    await page.getByRole("searchbox").fill("RevenueChart.js");
    assert.equal(await page.locator(".tmv2-row").count(), 2);
    await page.locator(".tmv2-row").filter({ hasText: "café spaces/%literal" }).click();
    const pathText = page.locator('.tmv2-id[aria-label="Full module ID"]');
    assert.equal(await pathText.textContent(), longId);
    assert.match(
      await pathText.evaluate((element) => getComputedStyle(element).fontFamily),
      /monospace/,
    );
    for (const viewport of [
      { width: 800, height: 600 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await settle(page);
      assert.equal(await pathText.textContent(), longId);
      const panel = await page.locator(".tmv2-inspector").boundingBox();
      assert(panel.width >= 300 && panel.width <= 380);
      assert(panel.y + panel.height <= viewport.height);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert((await page.locator(".tmv2-list").boundingBox()).height > 40);
    }
    if (process.env.INSPECTOR_SCREENSHOTS) {
      await fs.mkdir(process.env.INSPECTOR_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: path.join(
          process.env.INSPECTOR_SCREENSHOTS,
          url.includes("/viewer/") ? "viewer-v2.png" : "standalone-v2.png",
        ),
      });
    }
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.locator('.tmv2-node[data-output-key="root"]').click({ position: { x: 6, y: 6 } });
    await page.getByRole("button", { name: /^Files / }).click();
    await page.getByRole("searchbox").fill("pkg/impl.js");
    assert.equal(
      await page.locator(".tmv2-row").count(),
      2,
      "installed copies must remain distinct",
    );
    await page.locator(".tmv2-row").filter({ hasText: "parent/node_modules" }).click();
    assert.equal(await pathText.textContent(), "node_modules/parent/node_modules/pkg/impl.js");
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await page.getByRole("searchbox").fill("cycle-a.js");
    await page.locator(".tmv2-row").click();
    await page.getByRole("button", { name: /^Imports / }).click();
    const cycleGeometry = await geometry(page);
    await page.locator(".tmv2-row").click();
    assert.equal(await pathText.textContent(), "src/cycle-b.js");
    await page.locator(".tmv2-row").click();
    assert.equal(await pathText.textContent(), "src/cycle-a.js");
    assert.deepEqual(await geometry(page), cycleGeometry);
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await page.getByRole("searchbox").fill("self.js");
    await page.locator(".tmv2-row").click();
    await page
      .locator(".tmv2-row")
      .filter({ has: page.getByText("src/self.js", { exact: true }) })
      .click();
    assert.equal(
      await pathText.textContent(),
      "src/self.js",
      "following a self-import must retain the exact output selection",
    );
    await page.getByRole("button", { name: "Clear selection", exact: true }).click();
    await page.getByRole("button", { name: /^Imports / }).click();
    await page.getByRole("searchbox").fill("external-dep");
    await page.locator(".tmv2-row").click();
    assert.match(await page.locator(".tmv2-kind").innerText(), /External module/);
    assert.equal(await page.locator(".tmv2-measurement").innerText(), "No output measurement");
    assert(await page.getByRole("button", { name: "Zoom to selection", exact: true }).isDisabled());
    console.log("PASS treemap-v2 interactions: " + new URL(url).pathname);
    await page.close();
  }
  const isolatedPage = await context.newPage();
  await isolatedPage.goto(origin + "/isolated.html");
  const virtualId = String.raw`\0virtual-地域\0entry.js`;
  await isolatedPage.getByRole("searchbox").fill(String.raw`\0entry`);
  assert.equal(await isolatedPage.locator(".tmv2-file .tmv2-path").innerText(), virtualId);
  await isolatedPage.locator(".tmv2-node[data-module-id]").click({ position: { x: 5, y: 5 } });
  assert.equal(await isolatedPage.locator(".tmv2-id").innerText(), virtualId);
  assert.equal(await isolatedPage.locator(".tmv2-identity h2").innerText(), virtualId);
  assert.equal(await isolatedPage.locator(".tmv2-sections button").count(), 0);
  assert.equal(await isolatedPage.getByRole("searchbox").count(), 0);
  assert.match(
    await isolatedPage.locator(".tmv2-inspector").innerText(),
    /No imports or importers/,
  );
  await isolatedPage
    .locator('.tmv2-node[data-output-key="root"]')
    .click({ position: { x: 5, y: 5 } });
  assert.equal(await isolatedPage.locator(".tmv2-sections button").count(), 1);
  assert.equal(
    await isolatedPage.getByRole("button", { name: /^Files / }).getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await isolatedPage.locator(".tmv2-row").count(), 1);
  await isolatedPage.close();
  const multiPage = await context.newPage();
  await multiPage.goto(origin + "/multiple.html");
  await multiPage.locator('.tmv2-node[data-output-key="root"]').click({ position: { x: 6, y: 6 } });
  assert.equal(await multiPage.locator(".tmv2-row").count(), 2);
  await multiPage.getByRole("button", { name: /^Imported by / }).click();
  await multiPage.locator(".tmv2-row").first().click();
  assert.equal(await multiPage.locator(".tmv2-id").textContent(), "left.js");
  await multiPage.getByRole("button", { name: /^Imports / }).click();
  await multiPage.locator(".tmv2-row").click();
  assert.equal(await multiPage.locator(".tmv2-id").textContent(), "shared😀.js");
  assert.equal(await multiPage.locator(".tmv2-occurrences > div").count(), 2);
  assert.match(
    await multiPage.locator(".tmv2-measurement").innerText(),
    /Multiple output contributions/,
  );
  assert(
    await multiPage.getByRole("button", { name: "Zoom to selection", exact: true }).isDisabled(),
  );
  await multiPage
    .getByLabel("Output occurrence", { exact: true })
    .selectOption({ label: "left.js" });
  await multiPage.getByRole("button", { name: "Zoom to selection", exact: true }).click();
  assert.equal(await multiPage.locator(".tmv2-node[data-module-id]").count(), 1);
  assert.match(
    await multiPage.getByRole("navigation", { name: "Chart location" }).innerText(),
    /left.js/,
  );
  assert.equal(
    await multiPage.locator(".tmv2-occurrences > div").count(),
    0,
    "zoom must show the exact output occurrence in the panel",
  );
  assert.match(await multiPage.locator(".tmv2-measurement").innerText(), /left.js/);
  await multiPage.getByRole("button", { name: "Undo zoom", exact: true }).click();
  assert.equal(await multiPage.locator(".tmv2-occurrences > div").count(), 2);
  assert.equal(
    await multiPage.getByLabel("Output occurrence", { exact: true }).inputValue(),
    await multiPage
      .getByLabel("Output occurrence", { exact: true })
      .locator("option", { hasText: "left.js" })
      .getAttribute("value"),
  );
  await multiPage
    .getByLabel("Output occurrence", { exact: true })
    .selectOption({ label: "right.js" });
  await multiPage.getByRole("button", { name: "Zoom to selection", exact: true }).click();
  assert.match(
    await multiPage.getByRole("navigation", { name: "Chart location" }).innerText(),
    /right.js/,
  );
  await multiPage.locator(".tmv2-node[data-module-id]").click({ position: { x: 8, y: 8 } });
  assert.match(await multiPage.locator(".tmv2-measurement").innerText(), /right.js/);
  await multiPage.getByRole("button", { name: "Undo zoom", exact: true }).click();
  assert.equal(await multiPage.locator(".tmv2-occurrences > div").count(), 2);
  assert.equal(
    await multiPage
      .getByLabel("Output occurrence", { exact: true })
      .locator("option:checked")
      .innerText(),
    "right.js",
  );
  await multiPage.close();
  const metricsPage = await context.newPage();
  await metricsPage.goto(origin + "/metrics.html");
  await metricsPage
    .locator('.tmv2-node[data-output-key="root"]')
    .click({ position: { x: 6, y: 6 } });
  assert.equal(await metricsPage.locator(".size-selectors input").count(), 3);
  await metricsPage.getByRole("button", { name: /^Files / }).click();
  const firstFile = metricsPage.locator(".tmv2-file .tmv2-path").first();
  assert.equal(await firstFile.innerText(), "value.js");
  await metricsPage.getByLabel("Sort files").selectOption("path");
  assert.equal(await firstFile.innerText(), "empty.js");
  await metricsPage.getByLabel("Sort files").selectOption("size");
  assert.equal(await firstFile.innerText(), "value.js");
  await metricsPage.getByRole("searchbox").fill("value.js");
  await metricsPage.locator(".tmv2-row").click();
  await metricsPage.getByLabel("Gzip", { exact: true }).check();
  assert.match(await metricsPage.locator(".tmv2-measurement").innerText(), /^Gzip:/);
  await metricsPage.getByRole("button", { name: "Clear selection", exact: true }).click();
  assert.equal(await metricsPage.getByRole("searchbox").inputValue(), "");
  assert(await metricsPage.getByLabel("Gzip", { exact: true }).isChecked());
  await metricsPage.getByRole("searchbox").fill("empty.js");
  await metricsPage.locator(".tmv2-row").click();
  assert.match(await metricsPage.locator(".tmv2-measurement").innerText(), /^Gzip:\s*0\s*B\b/);
  await metricsPage.getByRole("button", { name: "Zoom to selection", exact: true }).click();
  const zeroRect = await metricsPage.locator(".tmv2-node[data-module-id]").boundingBox();
  assert(
    zeroRect.width > 200 && zeroRect.height > 100,
    "a real zero-byte output occurrence must be locatable without changing its measured size",
  );
  await metricsPage.locator("#module-filter-exclude").fill("**/empty.js");
  await metricsPage.waitForFunction(() =>
    document.querySelector(".tmv2-availability").textContent.includes("hidden"),
  );
  assert.equal(
    await metricsPage.locator(".tmv2-node").count(),
    0,
    "filtering a focused output must remove its rectangle even when it measures zero bytes",
  );
  await metricsPage.locator("#module-filter-exclude").fill("");
  await metricsPage.locator(".tmv2-node[data-module-id]").waitFor();
  await metricsPage.locator(".tmv2-node[data-module-id]").click({ position: { x: 8, y: 8 } });
  assert.equal(await metricsPage.locator(".tmv2-id").textContent(), "empty.js");
  await metricsPage.getByRole("button", { name: /^Imported by / }).click();
  await metricsPage.locator(".tmv2-row").first().click();
  await metricsPage.getByRole("button", { name: "Clear selection", exact: true }).click();
  assert.equal(await metricsPage.locator(".tmv2-identity h2").innerText(), "empty.js");
  assert.equal(await metricsPage.locator(".tmv2-node[data-module-id]").count(), 1);
  await metricsPage.getByRole("button", { name: "Undo zoom", exact: true }).click();
  assert.equal(await metricsPage.locator(".tmv2-identity h2").innerText(), "empty.js");
  assert(await metricsPage.getByLabel("Gzip", { exact: true }).isChecked());
  await metricsPage.getByRole("button", { name: "Overview", exact: true }).click();
  await settle(metricsPage);
  assert((await metricsPage.locator(".tmv2-node[data-module-id]").count()) > 1);
  await metricsPage.close();
  const mixedPage = await context.newPage();
  await mixedPage.goto(origin + "/mixed.html");
  await mixedPage.locator(".tmv2-node").first().waitFor();
  assert.equal(
    await mixedPage.locator(".size-selectors input").count(),
    0,
    "mixed CLI inputs must not advertise unavailable compression as measured zero",
  );
  const appChunks = mixedPage
    .locator('.tmv2-node[data-group="true"]')
    .filter({ hasText: /^app.js$/ });
  assert.equal(await appChunks.count(), 2);
  for (let index = 0; index < 2; index++) {
    await appChunks.nth(index).click({ position: { x: 6, y: 6 } });
    assert.match(
      await mixedPage.locator(".tmv2-measurement").innerText(),
      /100.00% of measured app.js/,
    );
  }
  await mixedPage.close();
  const legacy = await context.newPage();
  await legacy.goto(origin + "/legacy.html");
  await legacy.locator("svg .node").last().waitFor();
  const original = await legacy
    .locator("svg .node")
    .evaluateAll((nodes) =>
      nodes.map((node) => [
        node.getAttribute("transform"),
        node.querySelector("rect").getAttribute("width"),
      ]),
    );
  await legacy
    .locator("svg .node")
    .filter({ has: legacy.locator("text").filter({ hasText: /^入口😀\.js$/ }) })
    .locator("rect")
    .click({ position: { x: 5, y: 5 } });
  await legacy.waitForFunction(
    (before) =>
      JSON.stringify(
        [...document.querySelectorAll("svg .node")].map((node) => [
          node.getAttribute("transform"),
          node.querySelector("rect").getAttribute("width"),
        ]),
      ) !== before,
    JSON.stringify(original),
  );
  assert.equal(await legacy.locator(".treemap-v2").count(), 0);
  assert.notDeepEqual(
    await legacy
      .locator("svg .node")
      .evaluateAll((nodes) =>
        nodes.map((node) => [
          node.getAttribute("transform"),
          node.querySelector("rect").getAttribute("width"),
        ]),
      ),
    original,
    "original treemap must keep single-click zoom",
  );
  await legacy.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
console.log("Treemap v2 production checks passed. Fixture artifacts: " + directory);
