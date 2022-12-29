import { OutputAsset, OutputOptions, rollup } from "rollup";
import { describe, it, expect } from "@jest/globals";
import { ALL_TEMPLATE } from "./util";

// mock random for stable id
let randomCall = 0;
Math.random = () => randomCall / 100;

import { visualizer } from "../dist/plugin";

describe("GH-59", () => {
  const input = {
    index: "test/gh59/src/index",
    "components/index": "test/gh59/src/components/index",
    "components/A": "test/gh59/src/components/A",
    "components/B": "test/gh59/src/components/B",
  };

  it.each(ALL_TEMPLATE)("test - %j", async (template) => {
    const inputOptions = {
      input,
      plugins: [
        visualizer({
          filename: `stats`,
          template,
          emitFile: true,
          brotliSize: true,
          gzipSize: true
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


describe("GH-59 sourcemap", () => {
  const input = {
    index: "test/gh59/src/index",
    "components/index": "test/gh59/src/components/index",
    "components/A": "test/gh59/src/components/A",
    "components/B": "test/gh59/src/components/B",
  };

  it.each(ALL_TEMPLATE)("test - %j", async (template) => {
    const inputOptions = {
      input,
      plugins: [
        visualizer({
          filename: `stats`,
          template,
          emitFile: true,
          sourcemap: true,
          brotliSize: true,
          gzipSize: true
        }),
      ],
    };
    const outputOptions: OutputOptions = {
      format: "es",
      dir: "./temp/",
      sourcemap: true
    };

    const bundle = await rollup(inputOptions);

    const result = await bundle.generate(outputOptions);

    const generatedStats = result.output.find((file) => file.fileName === "stats");

    expect(generatedStats).not.toBe(null);
    expect((generatedStats as OutputAsset).source).toMatchSnapshot();
  });
});
