import { TemplateType } from "../plugin/template-types";

export const HTML_TEMPLATE: TemplateType[] = ["treemap", "sunburst", "network"];
export const PLAIN_TEMPLATE: TemplateType[] = ["raw-data", "list"];
export const ALL_TEMPLATE: TemplateType[] = [...HTML_TEMPLATE, ...PLAIN_TEMPLATE];
