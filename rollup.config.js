"use strict";

const commonJs = require("rollup-plugin-commonjs");
const path = require("path");
const postcss = require("rollup-plugin-postcss");
const resolve = require("rollup-plugin-node-resolve");
// const rollupUglify = require("rollup-plugin-uglify");

const plugins = [
  resolve(),
  commonJs({
    ignoreGlobal: true,
    include: "node_modules/**"
  }),
  // rollupUglify()
];

module.exports = [
  getConfig("sunburst"),
  getConfig("treemap"),
  getConfig("circlepacking")
];

function getConfig(templateType) {
  /** @type {import('rollup').RollupOptions} */
  const config = {
    $template: `${templateType}`,
    input: `./src/script-${templateType}.js`,
    output: {
      format: "iife",
      file: path.join(__dirname, `./lib/main-${templateType}.js`)
    },
    plugins: plugins.concat(postcss({
      extract: path.join(__dirname, `./lib/style-${templateType}.css`),
      plugins: [
        /* eslint-disable global-require */
        require("postcss-url")({
          basePath: __dirname,
          url: "inline"
        })
        /* eslint-enable */
      ]
    }))
  };
  return config;
}
