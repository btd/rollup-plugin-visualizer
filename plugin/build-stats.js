"use strict";

const fs = require("fs").promises;
const path = require("path");
const pupa = require("pupa");

module.exports = async function buildHtml({
  title,
  data,
  template,
  chartParameters,
}) {
  const [templateString, script, style] = await Promise.all([
    fs.readFile(path.join(__dirname, "stats.template"), "utf-8"),
    fs.readFile(
      path.join(__dirname, "..", "lib", `script-${template}.js`),
      "utf8"
    ),
    fs.readFile(
      path.join(__dirname, "..", "lib", `script-${template}.css`),
      "utf8"
    ),
  ]);

  return pupa(templateString, {
    title,
    style,
    script,
    nodesData: JSON.stringify(data),
    chartParameters: JSON.stringify(chartParameters),
  });
};
