import { OutputAsset, OutputChunk, OutputOptions, rollup } from "rollup";
import { describe, it, expect } from "@jest/globals";
import terser from '@rollup/plugin-terser';
import { ALL_TEMPLATE } from "../util";

// mock random for stable id
let randomCall = 0;
Math.random = () => randomCall / 100;

import { visualizer } from "../../dist/plugin";

describe("Sourcemap Comments", () => {
    const input = {
      index: "test/sourcemap-comments/input.js",
    };
  
    it("test", async () => {
      const inputOptions = {
        input,
        plugins: [
            terser(),
          visualizer({
            filename: `stats`,
            template: 'raw-data',
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

      const bundleChunk = result.output.find(file => file.fileName === "index.js")

      expect(bundleChunk).not.toBeNull();
      const bundleChunkCode = (bundleChunk as OutputChunk).code
      expect(bundleChunkCode).toMatchSnapshot();
      expect(Buffer.byteLength(bundleChunkCode)).toMatchSnapshot();
  
      const generatedStats = result.output.find((file) => file.fileName === "stats");
  
      expect(generatedStats).not.toBeNull();
      expect((generatedStats as OutputAsset).source).toMatchSnapshot();
    });
  });
  