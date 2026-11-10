import yargs from "yargs";

import TEMPLATE, { TemplateType } from "../template-types.js";
import { warn } from "../warn.js";

export const parseCliArgs = (args: string[]) => {
  const argv = yargs(args)
    .option("filename", {
      describe: "Output file name",
      type: "string",
      default: "./stats.html",
    })
    .option("title", {
      describe: "Output file title",
      type: "string",
      default: "Rollup Visualizer",
    })
    .option("template", {
      describe: "Template type",
      type: "string",
      choices: TEMPLATE,
      default: "treemap" as TemplateType,
    })
    .option("sourcemap", {
      describe: "Deprecated: has no effect; inputs must be plugin-generated raw-data JSON reports",
      type: "boolean",
    })
    .option("open", {
      describe: "Open generated tempate in default user agent",
      type: "boolean",
      default: false,
    })
    .help()
    .parseSync();

  if (argv.sourcemap !== undefined) {
    warn(
      "The CLI --sourcemap option is deprecated and has no effect. Inputs must be plugin-generated raw-data JSON reports. The plugin's sourcemap option remains supported.",
    );
  }

  return argv;
};
