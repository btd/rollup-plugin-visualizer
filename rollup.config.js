const commonJs = require("@rollup/plugin-commonjs");
const resolve = require("@rollup/plugin-node-resolve").default;
const typescript = require("@rollup/plugin-typescript");
const postcss = require("rollup-plugin-postcss");
const postcssUrl = require("postcss-url");

const HTML_TEMPLATE = ["treemap", "sunburst", "network"];

/** @type {import('rollup').RollupOptions} */
module.exports = HTML_TEMPLATE.map((templateType) => ({
  input: `./src/${templateType}/index.tsx`,

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
    ],
  ],

  output: {
    format: "iife",
    file: `./dist/lib/${templateType}.js`,
    name: "drawChart",
    exports: "named",
  },
}));
