import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import path from "node:path";

const assets = path.resolve(import.meta.dirname, "dist/viewer/assets");

export default {
  input: {
    index: "src/viewer/index.ts",
    report: "src/viewer/report.ts",
    "load.worker": "src/viewer/load.worker.ts",
  },
  plugins: [
    typescript({ tsconfig: "src/tsconfig.json", noEmitOnError: true, outDir: assets }),
    resolve({ browser: true }),
    postcss({ extract: path.join(assets, "viewer.css") }),
  ],
  output: {
    dir: assets,
    format: "es",
    entryFileNames: "[name].js",
    chunkFileNames: "chunks/[name]-[hash].js",
  },
};
