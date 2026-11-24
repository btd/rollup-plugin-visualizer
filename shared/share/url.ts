import { invalid } from "./limits.js";

export const VISUAL_TEMPLATES = [
  "treemap",
  "treemap-v2",
  "sunburst",
  "flamegraph",
  "network",
  "treemap-3d",
] as const;
export type VisualTemplate = (typeof VISUAL_TEMPLATES)[number];
export const VIEWER_BASE_URL = "https://btd.github.io/rollup-plugin-visualizer/";

export const isVisualTemplate = (value: string): value is VisualTemplate =>
  VISUAL_TEMPLATES.some((template) => template === value);

export const createReportUrl = (base: string, template: string, fragment: string): string => {
  if (!isVisualTemplate(template))
    return invalid(
      `Template "${template}" does not support link output. Choose a visual template or file output.`,
    );
  if (!/^[A-Za-z0-9]\.[A-Za-z0-9_-]+$/.test(fragment))
    return invalid("Invalid encoded report fragment.");
  const root = new URL(base);
  if (root.protocol !== "https:" && root.protocol !== "http:")
    return invalid("The viewer must use an HTTP or HTTPS address.");
  root.search = "";
  root.hash = "";
  if (!root.pathname.endsWith("/")) root.pathname += "/";
  const url = new URL(`${template}/`, root);
  // Some browser URL implementations discard oversized hashes in the setter.
  // Validate the base/path separately and preserve every payload character.
  return `${url.href}#${fragment}`;
};
