import { InputOptions, OutputAsset, OutputOptions, Plugin, rollup } from "rollup";
import { describe, it, expect } from "@jest/globals";
import { ALL_TEMPLATE } from "./util";

// mock random for stable id
let randomCall = 0;
Math.random = () => randomCall / 100;

import { visualizer } from "../dist/plugin";

describe("GH-93", () => {
  const input = "test/gh93/main.js";

  it.each(ALL_TEMPLATE)("test - %j", async (template) => {
    const inputOptions: InputOptions = {
      input,
      plugins: [
        {
          name: "pseudo-alias",
          resolveId(source) {
            if (source === "virtual-id") {
              return source;
            }
            return null;
          },
          load(id) {
            if (id === "virtual-id") {
              return 'console.log("virtual-id")';
            }
            return null;
          },
          async transform(code, id) {
            this.emitFile({
              type: "chunk",
              id: "virtual-id", // specifically id without \0000 as by rollup naming convention
            });
            return { code };
          },
        } as Plugin,
        visualizer({
          filename: `stats`,
          template,
          emitFile: true,
          brotliSize: true,
          gzipSize: true,
        }),
      ],

      onwarn(warn, def) {
        if (warn.code == "SOURCEMAP_BROKEN" && warn.plugin == "pseudo-alias") {
          return;
        }

        def(warn);
      },
    };
    const outputOptions: OutputOptions = {
      format: "es",
      dir: "./temp/",
    };

    const bundle = await rollup(inputOptions);

    const result = await bundle.generate(outputOptions);

    const generatedStats = result.output.find((file) => file.fileName === "stats");

    expect(generatedStats).not.toBe(null);
    expect((generatedStats as OutputAsset).source).toMatchSnapshot();
  });
});

describe("GH-93 sourcemap", () => {
  const input = "test/gh93/main.js";

  it.each(ALL_TEMPLATE)("test - %j", async (template) => {
    const inputOptions: InputOptions = {
      input,
      plugins: [
        {
          name: "pseudo-alias",
          resolveId(source) {
            if (source === "virtual-id") {
              return source;
            }
            return null;
          },
          load(id) {
            if (id === "virtual-id") {
              return 'console.log("virtual-id")';
            }
            return null;
          },
          async transform(code, id) {
            this.emitFile({
              type: "chunk",
              id: "virtual-id", // specifically id without \0000 as by rollup naming convention
            });
            return { code };
          },
        } as Plugin,
        visualizer({
          filename: `stats`,
          template,
          emitFile: true,
          sourcemap: true,
          brotliSize: true,
          gzipSize: true,
        }),
      ],
      onwarn(warn, def) {
        if (warn.code == "SOURCEMAP_BROKEN" && warn.plugin == "pseudo-alias") {
          return;
        }

        def(warn);
      },
    };
    const outputOptions: OutputOptions = {
      format: "es",
      dir: "./temp/",
      sourcemap: true,
    };

    const bundle = await rollup(inputOptions);

    const result = await bundle.generate(outputOptions);

    const generatedStats = result.output.find((file) => file.fileName === "stats");

    expect(generatedStats).not.toBe(null);
    expect((generatedStats as OutputAsset).source).toMatchSnapshot();
  });
});
