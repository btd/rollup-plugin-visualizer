"use strict";

const fs = require("fs");
const path = require("path");
const pupa = require("pupa");
const readFile = require("util").promisify(fs.readFile);

module.exports = async function buildHtml(title, nodesData, graphType) {
  const [template, script, style] = await Promise.all([
    readFile(path.join(__dirname, "./stats.template"), "utf-8"),
    readFile(path.join(__dirname, `./lib/main-${graphType}.js`), "utf8"),
    readFile(path.join(__dirname, `./lib/style-${graphType}.css`), "utf8"),
  ]);

  return pupa(template, {
    title,
    style,
    script,
    nodesData: JSON.stringify(nodesData),
  });
};
