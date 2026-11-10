import { promises as fs } from "node:fs";
import path from "node:path";

import { warn } from "../warn.js";
import { version } from "../version.js";
import {
  ModuleMeta,
  ModulePart,
  ModuleTree,
  ModuleUID,
  VisualizerData,
} from "../../shared/types.js";

interface ReportFile {
  file: string;
  data: VisualizerData;
}

export const readReports = async (files: string[]): Promise<ReportFile[]> => {
  if (files.length === 0) {
    throw new Error("Empty file list");
  }

  return Promise.all(
    files.map(async (file) => {
      const textContent = await fs.readFile(file, { encoding: "utf-8" });
      const data = JSON.parse(textContent) as VisualizerData;

      return { file, data };
    }),
  );
};

export const filterCompatibleReports = (fileContents: ReportFile[]): ReportFile[] => {
  const compatible = fileContents.filter(({ file, data }) => {
    if (data.version === version) return true;

    warn(
      `Version in ${file} is not supported (${data.version}). Current version ${version}. Skipping...`,
    );
    return false;
  });

  if (compatible.length === 0) throw new Error("No compatible reports found");
  return compatible;
};

export const warnAboutMixedSettings = (fileContents: ReportFile[]): void => {
  const first = fileContents[0];
  for (const { file, data } of fileContents.slice(1)) {
    const differences = (["gzip", "brotli", "sourcemap"] as const).filter(
      (setting) => data.options[setting] !== first.data.options[setting],
    );
    if (differences.length > 0) {
      warn(
        `Settings in ${file} differ from ${first.file} (${differences.join(", ")}). Using settings from ${first.file} for the merged report; measurements may not be comparable.`,
      );
    }
  }
};

export const mergeReports = (fileContents: ReportFile[]): VisualizerData => {
  const tree: ModuleTree = {
    name: "root",
    children: [],
  };
  const nodeParts: Record<ModuleUID, ModulePart> = {};
  const nodeMetas: Record<ModuleUID, ModuleMeta> = {};

  for (const { data } of fileContents) {
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

  return data;
};

export const writeReport = async (filename: string, fileContent: string): Promise<void> => {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  try {
    await fs.unlink(filename);
  } catch {
    // ignore
  }
  await fs.writeFile(filename, fileContent);
};
