import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve("dist/viewer");
describe("Static viewer artifact", () => {
  it("packages the index and six diagram entry points", () => {
    expect(fs.statSync(path.join(root, "index.html")).isFile()).toBe(true);
    for (const template of ["treemap", "treemap-v2", "sunburst", "flamegraph", "network", "treemap-3d"]) {
      expect(fs.statSync(path.join(root, template, "index.html")).isFile()).toBe(true);
      expect(fs.statSync(path.join(root, "assets", `${template}.js`)).isFile()).toBe(true);
      expect(fs.statSync(path.join(root, "assets", `${template}.css`)).isFile()).toBe(true);
    }
  });
  it("packages the report worker and GitHub Pages marker", () => {
    expect(fs.existsSync(path.join(root, "assets", "load.worker.js"))).toBe(true);
    expect(fs.existsSync(path.join(root, ".nojekyll"))).toBe(true);
  });
});
