import { OutputAsset, OutputOptions, rollup } from "rollup";
import { describe, expect, it } from "vitest";

import { visualizer } from "../plugin/index";
import { renderTemplate } from "../plugin/render-template";
import { VisualizerData } from "../shared/types";

describe("Markdown template", () => {
  it("adds report config notes from plugin runtime options", async () => {
    const inputOptions = {
      external: ["jquery"],
      input: {
        input: "./test/e2e/input.js",
      },
      plugins: [
        visualizer({
          filename: "stats",
          template: "markdown",
          emitFile: true,
          sourcemap: true,
          gzipSize: true,
          brotliSize: true,
          include: [{ file: "**/input.js" }],
          exclude: [{ file: "**/node_modules/**" }],
        }),
      ],
    };
    const outputOptions: OutputOptions = {
      format: "es",
      dir: "./temp/",
      sourcemap: true,
    };

    const bundle = await rollup(inputOptions);
    const result = await bundle.generate(outputOptions);
    const generatedStats = result.output.find((file) => file.fileName === "stats");

    expect(generatedStats).not.toBeNull();
    const source = String((generatedStats as OutputAsset).source);

    expect(source).toContain("## Notes");
    expect(source).toContain("## Per-Bundle Top Modules (Slices)");
    expect(source).toContain("## Top Module Bundle Membership (Slice)");
    expect(source).toContain("| sourcemap mode | `yes` |");
    expect(source).toContain("| output.sourcemap | `yes` |");
    expect(source).toContain("| gzip requested | `yes` |");
    expect(source).toContain("| gzip enabled | `no` |");
    expect(source).toContain("| brotli requested | `yes` |");
    expect(source).toContain("| brotli enabled | `no` |");
    expect(source).toContain("**/input.js");
    expect(source).toContain("**/node_modules/**");
    expect(source).toContain("Size precision depends on mode.");
    expect(source).toContain("include`/`exclude` filters remove unmatched modules");
  });

  it("uses fallback note values when report config is unavailable", async () => {
    const data: VisualizerData = {
      version: 2,
      tree: {
        name: "root",
        children: [],
      },
      nodeParts: {},
      nodeMetas: {},
      env: {
        rollup: "4.57.1",
      },
      options: {
        gzip: false,
        brotli: false,
        sourcemap: false,
      },
    };

    const markdown = await renderTemplate("markdown", {
      title: "test",
      data: JSON.stringify(data),
    });

    expect(markdown).toContain("| output.sourcemap | `not available` |");
    expect(markdown).toContain("## Per-Bundle Top Modules (Slices)");
    expect(markdown).toContain("## Top Module Bundle Membership (Slice)");
    expect(markdown).toContain("| gzip requested | `not available` |");
    expect(markdown).toContain("| include filters | not available |");
    expect(markdown).toContain("| exclude filters | not available |");
  });
});
