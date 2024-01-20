import { promises as fs } from "fs";
import path from "path";

import opn from "open";

import { renderTemplate } from "../plugin/render-template";
import { TemplateType } from "../plugin/template-types";
import { warn } from "../plugin/warn";
import { version } from "../plugin/version";
import { ModuleMeta, ModulePart, ModuleTree, ModuleUID, VisualizerData } from "../shared/types";

export interface MergeJsonOutputOptions {
  /**
   * List of input file paths to merge.
   */
  inputs: string[];
  /**
   * Output file name.
   *
   * @default "./stats.html"
   */
  filename?: string;
  /**
   * Output file title.
   *
   * @default "Rollup Visualizer"
   */
  title?: string;
  /**
   * Template type
   *
   * @default "treemap"
   */
  template?: TemplateType;
  /**
   * Open generated tempate in default user agent.
   *
   * @default false
   */
  open?: boolean;
}

export async function mergeJsonOutputs(options: MergeJsonOutputOptions): Promise<void> {
  const {
    inputs,
    filename = "./stats.html",
    title = "Rollup Visualizer",
    template = "treemap",
    open = false,
  } = options;

  if (inputs.length === 0) {
    throw new Error("Empty file list");
  }

  const fileContents = await Promise.all(
    inputs.map(async (file) => {
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
}
