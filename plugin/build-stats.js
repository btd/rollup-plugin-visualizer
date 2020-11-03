"use strict";

const fs = require("fs").promises;
const path = require("path");

const htmlEscape = (string) =>
  string
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildHtmlTemplate = ({ title, script, nodesData, style }) =>
  `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="ie=edge" />
  <title>${htmlEscape(title)}</title>
  <style>
${style}
  </style>
</head>
<body>
  <main></main>
  <script>
  /*<!--*/
${script}
  /*-->*/
  </script>
  <script>
    /*<!--*/
    const data = ${nodesData};

    const run = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      const chartNode = document.querySelector("main");
      drawChart(chartNode, data, width, height);
    };

    window.addEventListener('resize', run);

    document.addEventListener('DOMContentLoaded', run);
    /*-->*/
  </script>
</body>
</html>

`;

module.exports = async function buildHtml({ title, data, template }) {
  const [script, style] = await Promise.all([
    fs.readFile(path.join(__dirname, "..", "lib", `${template}.js`), "utf8"),
    fs.readFile(path.join(__dirname, "..", "lib", `${template}.css`), "utf8"),
  ]);

  return buildHtmlTemplate({
    title,
    style,
    script,
    nodesData: JSON.stringify(data),
  });
};
