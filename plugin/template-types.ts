"use strict";

export type TemplateType = "sunburst" | "treemap" | "network" | "raw-data" | "list";

const templates: ReadonlyArray<TemplateType> = [
  "sunburst",
  "treemap",
  "network",
  "list",
  "raw-data",
];

export default templates;
