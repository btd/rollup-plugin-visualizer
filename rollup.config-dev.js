const commonJs = require("@rollup/plugin-commonjs");
const resolve = require("@rollup/plugin-node-resolve").default;
const typescript = require("@rollup/plugin-typescript");
const postcss = require("rollup-plugin-postcss");
const postcssUrl = require("postcss-url");

const { visualizer } = require(".");

const HTML_TEMPLATE = ["treemap", "sunburst", "network", "flamegraph"];
const PLAIN_TEMPLATE = ["raw-data", "list"];
const ALL_TEMPLATE = [...HTML_TEMPLATE, ...PLAIN_TEMPLATE];

const chooseExt = (template) => {
  if (template === "raw-data") return ".json";

  if (template === "list") return ".yml";

  return ".html";
};

/** @type {import('rollup').RollupOptions} */
module.exports = ALL_TEMPLATE.map((templateType) => ({
  input: Object.fromEntries(HTML_TEMPLATE.map((t) => [t, `./src/${t}/index.tsx`])),

  plugins: [
    [
      typescript({ tsconfig: "./src/tsconfig.json", noEmitOnError: true }),
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
        open: !!process.env.OPEN
      }),
    ],
  ],

  output: {
    format: "es",
    dir: `./temp/`,
    sourcemap: !!process.env.SOURCEMAP,
  },
}));
