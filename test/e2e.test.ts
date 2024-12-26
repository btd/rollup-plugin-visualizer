import { OutputAsset, OutputOptions, rollup } from "rollup";
import { describe, it, expect } from "vitest";
import { ALL_TEMPLATE } from "./util";

// mock random for stable id
let randomCall = 0;
Math.random = () => randomCall / 100;

import { visualizer } from "../dist/plugin";

describe("E2E", () => {
  const input = {
    input: "./test/e2e/input.js",
    input2: "./test/e2e/input2.js",
  };

  it.each(ALL_TEMPLATE)("test - %j", async (template) => {
    const inputOptions = {
      external: ["jquery"],
      input,
      plugins: [
        visualizer({
          filename: `stats`,
          template,
          exclude: [{ file: "**/node_modules/**" }],
          emitFile: true,
          brotliSize: true,
          gzipSize: true,
        }),
      ],
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

describe("E2E sourcemap", () => {
  const input = {
    input: "./test/e2e/input.js",
    input2: "./test/e2e/input2.js",
  };

  it.each(ALL_TEMPLATE)("test - %j", async (template) => {
    const inputOptions = {
      external: ["jquery"],
      input,
      plugins: [
        visualizer({
          filename: `stats`,
          template,
          exclude: [{ file: "**/node_modules/**" }],
          emitFile: true,
          sourcemap: true,
          brotliSize: true,
          gzipSize: true,
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

    expect(generatedStats).not.toBe(null);
    expect((generatedStats as OutputAsset).source).toMatchSnapshot();
  });
});
