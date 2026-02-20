import { TemplateType } from "../template-types.js";
import { buildHtml } from "./html.js";
import { outputPlainTextList } from "./list.js";
import { outputMarkdown } from "./markdown.js";
import { outputRawData } from "./raw-data.js";
import { RenderTemplateOptions, TemplateRenderer } from "./types.js";

const TEMPLATE_TYPE_RENDERED: Record<TemplateType, TemplateRenderer> = {
  network: buildHtml("network"),
  sunburst: buildHtml("sunburst"),
  treemap: buildHtml("treemap"),
  "raw-data": async ({ data }) => outputRawData(data),
  list: async ({ data }) => outputPlainTextList(data),
  markdown: async ({ data, reportConfig }) => outputMarkdown(data, reportConfig),
  flamegraph: buildHtml("flamegraph"),
};

export const renderTemplate = (templateType: TemplateType, options: RenderTemplateOptions) => {
  return TEMPLATE_TYPE_RENDERED[templateType](options);
};

export type { RenderTemplateOptions, RenderTemplateReportConfig } from "./types.js";
