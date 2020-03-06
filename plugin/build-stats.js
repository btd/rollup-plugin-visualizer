"use strict";

const fs = require("fs").promises;
const path = require("path");
const pupa = require("pupa");

module.exports = async function buildHtml({
  title,
  nodesData,
  graphType,
  chartParameters
}) {
  const [template, script, style] = await Promise.all([
    fs.readFile(path.join(__dirname, "stats.template"), "utf-8"),
    fs.readFile(
      path.join(__dirname, "..", "lib", `script-${graphType}.js`),
      "utf8"
    ),
    fs.readFile(
      path.join(__dirname, "..", "lib", `script-${graphType}.css`),
      "utf8"
    )
  ]);

  return pupa(template, {
    title,
    style,
    script,
    nodesData: JSON.stringify(nodesData),
    chartParameters: JSON.stringify(chartParameters)
  });
};
