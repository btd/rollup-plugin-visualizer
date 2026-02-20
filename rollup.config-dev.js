import commonJs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import postcssUrl from "postcss-url";
import { visualizer } from "./dist/plugin/index.js";

const HTML_TEMPLATE = ["treemap", "sunburst", "network", "flamegraph"];
const PLAIN_TEMPLATE = ["raw-data", "list", "markdown"];
const ALL_TEMPLATE = [...HTML_TEMPLATE, ...PLAIN_TEMPLATE];

const chooseExt = (template) => {
  if (template === "raw-data") return ".json";

  if (template === "list") return ".yml";
  if (template === "markdown") return ".md";

  return ".html";
};

/** @type {import('rollup').RollupOptions} */
export default ALL_TEMPLATE.map((templateType) => ({
  input: Object.fromEntries(HTML_TEMPLATE.map((t) => [t, `./src/${t}/index.tsx`])),

  plugins: [
    typescript({ tsconfig: "./src/tsconfig.json", outDir: "./temp/", noEmitOnError: true }),
    resolve({ mainFields: ["module", "main"] }),
    commonJs({
      ignoreGlobal: true,
      include: ["node_modules/**"],
    }),
    postcss({
      extract: true,
      plugins: [
        postcssUrl({
          url: "inline",
        }),
      ],
    }),
    visualizer({
      title: `dev build ${templateType}`,
      filename: `stats.${templateType}${chooseExt(templateType)}`,
      template: templateType,
      gzipSize: true,
      brotliSize: true,
      sourcemap: !!process.env.SOURCEMAP,
      open: !!process.env.OPEN,
    }),
  ],

  output: {
    format: "es",
    dir: `./temp/`,
    sourcemap: !!process.env.SOURCEMAP,
  },
}));
