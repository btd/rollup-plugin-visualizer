#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import TEMPLATE, { TemplateType } from "../plugin/template-types";
import { warn } from "../plugin/warn";
import { mergeJsonOutputs } from "../plugin";

const argv = yargs(hideBin(process.argv))
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
    describe: "Provided files are sourcemaps",
    type: "boolean",
    default: false,
    deprecated: true, // unused
  })
  .option("open", {
    describe: "Open generated tempate in default user agent",
    type: "boolean",
    default: false,
  })
  .help()
  .parseSync();

mergeJsonOutputs({
  inputs: argv._ as string[],
  ...argv,
}).catch((err: Error) => {
  warn(err.message);
  process.exit(1);
});
