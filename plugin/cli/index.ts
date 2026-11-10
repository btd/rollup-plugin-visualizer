import { promises as fs } from "node:fs";
import path from "node:path";

import opn from "open";
import yargs from "yargs";

import { renderTemplate } from "../render-template.js";
import TEMPLATE, { TemplateType } from "../template-types.js";
import { warn } from "../warn.js";
import { version } from "../version.js";
import {
  ModuleMeta,
  ModulePart,
  ModuleTree,
  ModuleUID,
  VisualizerData,
} from "../../shared/types.js";

interface CliArgs {
  filename: string;
  title: string;
  template: TemplateType;
  open: boolean;
}

const runForPluginJson = async ({ title, template, filename, open }: CliArgs, files: string[]) => {
  if (files.length === 0) {
    throw new Error("Empty file list");
  }

  const fileContents = await Promise.all(
    files.map(async (file) => {
      const textContent = await fs.readFile(file, { encoding: "utf-8" });
      const data = JSON.parse(textContent) as VisualizerData;

      return { file, data };
    }),
  );

  const tree: ModuleTree = {
    name: "root",
    children: [],
  };
  const nodeParts: Record<ModuleUID, ModulePart> = {};
  const nodeMetas: Record<ModuleUID, ModuleMeta> = {};

  for (const { file, data } of fileContents) {
    if (data.version !== version) {
      warn(
        `Version in ${file} is not supported (${data.version}). Current version ${version}. Skipping...`,
      );
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

  const fileContent = await renderTemplate(template, {
    title,
    data: JSON.stringify(data),
  });

  await fs.mkdir(path.dirname(filename), { recursive: true });
  try {
    await fs.unlink(filename);
  } catch {
    // ignore
  }
  await fs.writeFile(filename, fileContent);

  if (open) {
    await opn(filename);
  }
};

export const runCli = async (args: string[]): Promise<void> => {
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

  await runForPluginJson(argv, argv._ as string[]);
};
