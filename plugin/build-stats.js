"use strict";

const fs = require("fs");
const path = require("path");
const pupa = require("pupa");
const readFile = require("util").promisify(fs.readFile);

module.exports = async function buildHtml(
  title,
  nodesData,
  graphType,
  styleOverridePath,
  chartParameters
) {
  const [template, script, style, styleOverride] = await Promise.all([
    readFile(path.join(__dirname, "stats.template"), "utf-8"),
    readFile(path.join(__dirname, "..", "lib", `script-${graphType}.js`), "utf8"),
    readFile(path.join(__dirname, "..", "lib", `script-${graphType}.css`), "utf8"),
    styleOverridePath ? readFile(styleOverridePath, "utf8") : Promise.resolve("")
  ]);

  return pupa(template, {
    title,
    style,
    script,
    styleOverride,
    nodesData: JSON.stringify(nodesData),
    chartParameters: JSON.stringify(chartParameters)
  });
};
