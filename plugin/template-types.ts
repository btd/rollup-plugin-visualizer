"use strict";

export type TemplateType =
  | "sunburst"
  | "treemap"
  | "treemap-v2"
  | "treemap-3d"
  | "network"
  | "raw-data"
  | "list"
  | "markdown"
  | "flamegraph";

const templates: ReadonlyArray<TemplateType> = [
  "sunburst",
  "treemap",
  "treemap-v2",
  "treemap-3d",
  "network",
  "list",
  "markdown",
  "raw-data",
  "flamegraph",
];

export default templates;
