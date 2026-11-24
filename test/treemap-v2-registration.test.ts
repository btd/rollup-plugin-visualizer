import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rollup } from "rollup";
import { visualizer } from "../dist/plugin/index.js";
import { decodeFragment } from "../dist/shared/share/transport.js";
import templates from "../plugin/template-types";
import { createReportUrl, VISUAL_TEMPLATES } from "../shared/share/url";

describe("Treemap v2 registration", () => {
  it("is accepted by plugin/CLI types and viewer URL construction", () => {
    expect(templates).toContain("treemap-v2");
    expect(VISUAL_TEMPLATES).toContain("treemap-v2");
    expect(createReportUrl("https://example.test/viewer/", "treemap-v2", "1.example")).toBe(
      "https://example.test/viewer/treemap-v2/#1.example",
    );
  });
  it("packages the separate renderer and viewer route alongside the original", () => {
    for (const name of ["treemap", "treemap-v2"]) {
      expect(existsSync(`dist/lib/${name}.js`)).toBe(true);
      expect(existsSync(`dist/lib/${name}.css`)).toBe(true);
      expect(existsSync(`dist/viewer/${name}/index.html`)).toBe(true);
      expect(existsSync(`dist/viewer/assets/${name}.js`)).toBe(true);
    }
  });
  it("prints a usable link to the new template from an actual Rollup build", async () => {
    const messages: string[] = [];
    const bundle = await rollup({
      input: "/link.js",
      onLog(level, log) {
        if (level === "info") messages.push(log.message);
      },
      plugins: [
        {
          name: "v2-link-fixture",
          resolveId: (id) => id,
          load: () => "export const value = Math.random();",
        },
        visualizer({ template: "treemap-v2", output: "link", title: "Inspector 😀" }),
      ],
    });
    try {
      await bundle.generate({ format: "es" });
    } finally {
      await bundle.close();
    }
    const link = messages.find((message) => message.includes("/treemap-v2/#"))!;
    expect(link).toBeDefined();
    const report = await decodeFragment(new URL(link.slice(link.indexOf("https://"))).hash);
    expect(report.title).toBe("Inspector 😀");
    expect(Object.keys(report.data.nodeMetas)).not.toHaveLength(0);
  });
});
