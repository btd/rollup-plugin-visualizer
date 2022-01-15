#!/usr/bin/env node

import { promises as fs } from "fs";
import path from "path";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { buildHtml } from "../plugin/build-stats";
import TEMPLATE, { TemplateType } from "../plugin/template-types";
import { warn } from "../plugin/warn";
import { version } from "../plugin/version";
import { ModuleMeta, ModulePart, ModuleTree, ModuleUID, VisualizerData } from "../types/types";

const argv = yargs(hideBin(process.argv))
  .option("filename", {
    describe: "Output file name",
    type: "string",
    default: "./stats.html",
  })
  .option("title", {
    describe: "Output file title",
    type: "string",
    default: "RollUp Visualizer",
  })
  .option("template", {
    describe: "Template type",
    type: "string",
    choices: TEMPLATE,
    default: "treemap" as TemplateType,
  })
  .option("sourcemap", {
    describe: "Provided files is sourcemaps",
    type: "boolean",
    default: false,
  })
  .help()
  .parseSync();

const listOfFiles = argv._;

interface CliArgs {
  filename: string;
  title: string;
  template: TemplateType;
  sourcemap: boolean;
}

const runForPluginJson = async ({ title, template, filename }: CliArgs, files: string[]) => {
  if (files.length === 0) {
    throw new Error("Empty file list");
  }

  const fileContents = await Promise.all(
    files.map(async (file) => {
      const textContent = await fs.readFile(file, { encoding: "utf-8" });
      const data = JSON.parse(textContent) as VisualizerData;

      return { file, data };
    })
  );

  const tree: ModuleTree = {
    name: "root",
    children: [],
  };
  const nodeParts: Record<ModuleUID, ModulePart> = {};
  const nodeMetas: Record<ModuleUID, ModuleMeta> = {};

  for (const { file, data } of fileContents) {
    if (data.version !== version) {
      warn(`Version in ${file} is not supported (${data.version}). Current version ${version}. Skipping...`);
      continue;
    }

    if (data.tree.name === "root") {
      tree.children = tree.children.concat(data.tree.children);
    } else {
      tree.children.push(data.tree);
    }

    Object.assign(nodeParts, data.nodeParts);
    Object.assign(nodeMetas, data.nodeMetas);
  }

  const data: VisualizerData = {
    version,
    tree,
    nodeParts,
    nodeMetas,
    env: fileContents[0].data.env,
    options: fileContents[0].data.options,
  };

  const fileContent = await buildHtml({
    title,
    data,
    template,
  });

  await fs.mkdir(path.dirname(filename), { recursive: true });
  try {
    await fs.unlink(filename);
  } catch (err) {
    // ignore
  }
  await fs.writeFile(filename, fileContent);
};

runForPluginJson(argv, listOfFiles as string[]).catch((err: Error) => {
  warn(err.message);
  process.exit(1);
});
