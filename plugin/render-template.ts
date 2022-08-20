/* eslint-disable @typescript-eslint/require-await */
import { promises as fs } from "fs";
import path from "path";
import { BundleId, ModuleLengths, VisualizerData } from "../types/types";
import { TemplateType } from "./template-types";

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

export type RenderTemplateOptions = {
  data: VisualizerData;
  title: string;
};

const buildHtml =
  (template: TemplateType) =>
  async ({ title, data }: RenderTemplateOptions): Promise<string> => {
    const [script, style] = await Promise.all([
      fs.readFile(path.join(__dirname, "..", "lib", `${template}.js`), "utf8"),
      fs.readFile(path.join(__dirname, "..", "lib", `${template}.css`), "utf8"),
    ]);

    return buildHtmlTemplate(title, script, JSON.stringify(data), style);
  };

const outputRawData = (data: VisualizerData) => JSON.stringify(data, null, 2);

const outputPlainTextList = (data: VisualizerData) => {
  const bundles: Record<BundleId, [string, ModuleLengths][]> = {};

  for (const meta of Object.values(data.nodeMetas)) {
    for (const [bundleId, uid] of Object.entries(meta.moduleParts)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { mainUid, ...lengths } = data.nodeParts[uid];

      bundles[bundleId] = bundles[bundleId] ?? [];
      bundles[bundleId].push([meta.id, lengths]);
    }
  }

  const bundlesEntries = Object.entries(bundles).sort((e1, e2) => e1[0].localeCompare(e2[0]));

  let output = "";
  const IDENT = "  ";

  for (const [bundleId, files] of bundlesEntries) {
    output += bundleId + ":\n";

    files.sort((e1, e2) => e1[0].localeCompare(e2[0]));

    for (const [file, lengths] of files) {
      output += IDENT + file + ":\n";
      output += IDENT + IDENT + `rendered: ${String(lengths.renderedLength)}\n`;
      if (data.options.gzip) {
        output += IDENT + IDENT + `gzip: ${String(lengths.gzipLength)}\n`;
      }
      if (data.options.brotli) {
        output += IDENT + IDENT + `brotli: ${String(lengths.brotliLength)}\n`;
      }
    }
  }

  return output;
};

const TEMPLATE_TYPE_RENDERED: Record<
  TemplateType,
  (options: RenderTemplateOptions) => Promise<string>
> = {
  network: buildHtml("network"),
  sunburst: buildHtml("sunburst"),
  treemap: buildHtml("treemap"),
  "raw-data": async ({ data }) => outputRawData(data),
  list: async ({ data }) => outputPlainTextList(data),
};

export const renderTemplate = (templateType: TemplateType, options: RenderTemplateOptions) => {
  return TEMPLATE_TYPE_RENDERED[templateType](options);
};
