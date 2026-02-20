"use strict";

export type TemplateType =
  | "sunburst"
  | "treemap"
  | "network"
  | "raw-data"
  | "list"
  | "markdown"
  | "flamegraph";

const templates: ReadonlyArray<TemplateType> = [
  "sunburst",
  "treemap",
  "network",
  "list",
  "markdown",
  "raw-data",
  "flamegraph",
];

export default templates;
