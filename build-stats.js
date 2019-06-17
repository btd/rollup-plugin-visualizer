"use strict";

const Mustache = require("mustache");
const path = require("path");
const readFile = require("util").promisify(require("fs").readFile);

module.exports = async function buildHtml(title, nodesData, graphType) {
  const style = await readFile(
    path.join(__dirname, `./lib/style-${graphType}.css`),
    "utf8"
  );
  const script = await readFile(
    path.join(__dirname, `./lib/main-${graphType}.js`),
    "utf8"
  );

  const fontWeight = 500;
  const font = {
    name: "Oswald",
    weight: fontWeight,
    woff: await readFont("woff", fontWeight),
    woff2: await readFont("woff2", fontWeight)
  };

  const template = await readFile(
    path.join(__dirname, "./stats.mustache"),
    "utf-8"
  );
  return Mustache.render(template, {
    title,
    font,
    style,
    script,
    nodesData: JSON.stringify(nodesData),
  });
};

async function readFont(type = "woff", weight = 700) {
  const fonts = path.join(require.resolve("typeface-oswald"), "../files");
  const buffer = await readFile(path.join(fonts, `./oswald-latin-${weight}.${type}`));
  return buffer.toString("base64");
}
