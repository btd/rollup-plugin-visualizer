"use strict";

const rollupCommonJs = require("rollup-plugin-commonjs");
const rollupNodeResolve = require("rollup-plugin-node-resolve");

module.exports = {
  output: { format: "iife" },
  plugins: [
    rollupNodeResolve({
      mainFields: ["module", "jsnext", "main"]
    }),
    rollupCommonJs({
      ignoreGlobal: true,
      include: "node_modules/**"
    }) //,
    //rollupUglify()
  ]
};
