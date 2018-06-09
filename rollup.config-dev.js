"use strict";

const rollupCommonJs = require("rollup-plugin-commonjs");
const rollupNodeResolve = require("rollup-plugin-node-resolve");
const { uglify: rollupUglify } = require("rollup-plugin-uglify");
const plugin = require("./plugin");

module.exports = {
  input: "./src/plugin1.js",
  output: { format: "iife" },
  plugins: [
    rollupNodeResolve({
      jsnext: true,
      main: true,
      module: true
    }),
    rollupCommonJs({
      ignoreGlobal: true,
      include: "node_modules/**"
    }),
    plugin()
  ]
};
