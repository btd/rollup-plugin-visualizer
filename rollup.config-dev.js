"use strict";

const rollupCommonJs = require("rollup-plugin-commonjs");
const rollupNodeResolve = require("rollup-plugin-node-resolve");
const plugin = require("./plugin");

module.exports = {
  output: { format: "iife" },
  plugins: [
    rollupNodeResolve({
      mainFields: ["module", "jsnext", "main"]
    }),
    rollupCommonJs({
      ignoreGlobal: true,
      include: "node_modules/**"
    }),
    plugin({ open: true })
  ]
};
