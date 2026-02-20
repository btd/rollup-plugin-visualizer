/* eslint-disable @typescript-eslint/require-await */
import { promises as fs } from "node:fs";
import path from "node:path";
import { TemplateType } from "../template-types.js";
import { RenderTemplateOptions } from "./types.js";

const htmlEscape = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildHtmlTemplate = (title: string, script: string, nodesData: string, style: string) =>
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
      drawChart.default(chartNode, data, width, height);
    };

    window.addEventListener('resize', run);

    document.addEventListener('DOMContentLoaded', run);
    /*-->*/
  </script>
</body>
</html>

`;

export const buildHtml =
  (template: TemplateType) =>
  async ({ title, data }: RenderTemplateOptions): Promise<string> => {
    const [script, style] = await Promise.all([
      fs.readFile(path.join(import.meta.dirname, "..", "..", "lib", `${template}.js`), "utf8"),
      fs.readFile(path.join(import.meta.dirname, "..", "..", "lib", `${template}.css`), "utf8"),
    ]);

    return buildHtmlTemplate(title, script, data, style);
  };
