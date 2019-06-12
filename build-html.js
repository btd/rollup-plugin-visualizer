"use strict";

const fs = require("fs").promises;
const path = require("path");

const readFont = async (type = "woff", weight = 700) => {
  const fonts = path.join(require.resolve("typeface-oswald"), "..", "files");
  const buffer = await fs.readFile(path.join(fonts, `./oswald-latin-${weight}.${type}`));

  return buffer.toString("base64");
};

const buildFontface = (name, weight, { woff2, woff }) =>
  `@font-face {
      font-family: '${name}';
      font-display: swap;
      font-style: normal;
      font-weight: ${weight};
      src:
        url(data:font/woff2;charset=utf-8;base64,${woff2}) format('woff2'),
        url(data:application/font-woff;charset=utf-8;base64,${woff}) format('woff');
    }`;

const fontWeight = 500;

const woff = readFont("woff", fontWeight);
const woff2 = readFont("woff2", fontWeight);

//TODO add escaping
const buildHtml = async (title, root, template) => {
  const cssString = await fs.readFile(
    path.join(__dirname, "lib", `./style-${template}.css`),
    "utf8"
  );
  const jsString = await fs.readFile(path.join(__dirname, "lib", `./main-${template}.js`), "utf8");

  const fontface = buildFontface("Oswald", fontWeight, {
    woff: await woff,
    woff2: await woff2
  });

  return `<!doctype html>
        <title>${title}</title>
        <meta charset="utf-8">
        <style>${cssString}\n${fontface}</style>
        <div>
        <div>
            <h1>${title}</h1>
  
            <div id="charts">
            </div>
        </div>
        </div>
        <script>window.nodesData = ${JSON.stringify(root)};</script>
        <script charset="UTF-8">
          ${jsString}
        </script>
    `;
};

module.exports = buildHtml;
