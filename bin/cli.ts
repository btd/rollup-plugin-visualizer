#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";

import opn from "tiny-open";

import { renderTemplate } from "../plugin/render-template.js";
import TEMPLATE, { TemplateType } from "../plugin/template-types.js";
import { warn } from "../plugin/warn.js";
import { version } from "../plugin/version.js";
import { ModuleMeta, ModulePart, ModuleTree, ModuleUID, VisualizerData } from "../shared/types.js";

const USAGE = `Usage: rollup-plugin-visualizer [options] <file..>

Options:
  --filename <path>    Output file name [default: "./stats.html"]
  --title <title>      Output file title [default: "Rollup Visualizer"]
  --template <type>    Template type [default: "treemap"]
                       One of: ${TEMPLATE.join(", ")}
  --sourcemap          Provided files is sourcemaps
  --open               Open generated tempate in default user agent
  --version            Show version number
  --help               Show this help`;

// Resolved from the compiled location of this file (dist/bin/cli.js)
const { version: packageVersion } = createRequire(import.meta.url)("../../package.json") as {
  version: string;
};

const isTemplateType = (value: string): value is TemplateType =>
  (TEMPLATE as ReadonlyArray<string>).includes(value);

interface CliArgs {
  filename: string;
  title: string;
  template: TemplateType;
  sourcemap: boolean;
  open: boolean;
}

const parseCliArgs = (): { args: CliArgs; files: string[] } => {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      filename: { type: "string", default: "./stats.html" },
      title: { type: "string", default: "Rollup Visualizer" },
      template: { type: "string", default: "treemap" },
      sourcemap: { type: "boolean", default: false },
      open: { type: "boolean", default: false },
      version: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (values.version) {
    console.log(packageVersion);
    process.exit(0);
  }

  if (!isTemplateType(values.template)) {
    throw new Error(`Invalid template "${values.template}". Choices: ${TEMPLATE.join(", ")}`);
  }

  return {
    args: {
      filename: values.filename,
      title: values.title,
      template: values.template,
      sourcemap: values.sourcemap,
      open: values.open,
    },
    files: positionals,
  };
};

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
  } catch (err) {
    // ignore
  }
  await fs.writeFile(filename, fileContent);

  if (open) {
    await opn(filename);
  }
};

const main = async () => {
  const { args, files } = parseCliArgs();
  await runForPluginJson(args, files);
};

main().catch((err: Error) => {
  warn(err.message);
  process.exit(1);
});
