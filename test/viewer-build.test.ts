import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve("dist/viewer");
describe("Static viewer artifact", () => {
  it("contains a local-file index and five real template pages under relative asset paths", () => {
    const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
    expect(index).toContain('type="file"');
    expect(index).toContain('aria-live="polite"');
    expect(index).not.toContain("drawChart");
    for (const template of ["treemap", "sunburst", "flamegraph", "network", "treemap-3d"]) {
      const html = fs.readFileSync(path.join(root, template, "index.html"), "utf8");
      expect(html).toContain(`data-template="${template}"`);
      expect(html).toContain(`../assets/${template}.js`);
      expect(html).not.toContain('type="file"');
      expect(html).not.toContain("<select");
    }
  });
  it("packages only application assets without inline scripts or report fixtures", () => {
    for (const name of fs.readdirSync(root, { recursive: true, encoding: "utf8" })) {
      if (!fs.statSync(path.join(root, name)).isFile()) continue;
      expect(name).not.toMatch(/stats|fixture|raw-data|\.map$/);
      if (name.endsWith(".html")) {
        const html = fs.readFileSync(path.join(root, name), "utf8");
        expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
        expect(html).toContain('name="referrer" content="no-referrer"');
      }
    }
    expect(fs.existsSync(path.join(root, "assets", "load.worker.js"))).toBe(true);
    expect(fs.existsSync(path.join(root, ".nojekyll"))).toBe(true);
  });
});
