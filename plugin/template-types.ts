"use strict";

export type TemplateType = "sunburst" | "treemap" | "network" | "raw-data" | "list" | "flamegraph";

const templates: ReadonlyArray<TemplateType> = [
  "sunburst",
  "treemap",
  "network",
  "list",
  "raw-data",
  "flamegraph",
];

export default templates;
