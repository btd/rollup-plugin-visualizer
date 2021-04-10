import { promises as fs } from "fs";
import path from "path";

import { OutputBundle, Plugin, NormalizedOutputOptions } from "rollup";
import opn from "open";

import { version } from "./version";

import { createGzipSizeGetter, createBrotliSizeGetter, SizeGetter } from "./compress";

import { TemplateType } from "./template-types";
import { ModuleMapper } from "./module-mapper";
import { addLinks, buildTree, mergeTrees } from "./data";
import { getSourcemapModules } from "./sourcemap";
import { buildHtml } from "./build-stats";
import {
  ModuleLink,
  ModuleRenderInfo,
  ModuleRenderSizes,
  ModuleTree,
  ModuleTreeLeaf,
  VisualizerData,
} from "../types/types";

const WARN_SOURCEMAP_DISABLED =
  "rollup output configuration missing sourcemap = true. You should add output.sourcemap = true or disable sourcemap in this plugin";

const WARN_SOURCEMAP_MISSING = (id: string) => `${id} missing source map`;

export interface PluginVisualizerOptions {
  json?: boolean;
  filename?: string;
  title?: string;
  open?: boolean;
  openOptions?: opn.Options;
  template?: TemplateType;
  gzipSize?: boolean;
  brotliSize?: boolean;
  sourcemap?: boolean;
  projectRoot?: string | RegExp;
}

interface AdditionalRenderInfo {
  gzipLength?: number;
  brotliLength?: number;
}

const defaultSizeGetter: SizeGetter = () => Promise.resolve(0);

export const visualizer = (opts: PluginVisualizerOptions = {}): Plugin => {
  const json = !!opts.json;
  const filename = opts.filename ?? (json ? "stats.json" : "stats.html");
  const title = opts.title ?? "RollUp Visualizer";

  const open = !!opts.open;
  const openOptions = opts.openOptions ?? {};

  const template = opts.template ?? "treemap";
  const projectRoot = opts.projectRoot ?? process.cwd();

  const gzipSize = !!opts.gzipSize;
  const brotliSize = !!opts.brotliSize;
  const gzipSizeGetter = gzipSize
    ? createGzipSizeGetter(typeof opts.gzipSize === "object" ? opts.gzipSize : {})
    : defaultSizeGetter;
  const brotliSizeGetter = brotliSize
    ? createBrotliSizeGetter(typeof opts.brotliSize === "object" ? opts.brotliSize : {})
    : defaultSizeGetter;

  const getAdditionalFilesInfo = async (code: string | null) => {
    const info: AdditionalRenderInfo = {};
    if (gzipSize) {
      info.gzipLength = code == null || code == "" ? 0 : await gzipSizeGetter(code);
    }
    if (brotliSize) {
      info.brotliLength = code == null || code == "" ? 0 : await brotliSizeGetter(code);
    }
    return info;
  };

  const renderedModuleToInfo = async (
    id: string,
    mod: { renderedLength: number; code: string | null }
  ): Promise<ModuleRenderInfo> => ({
    id,
    ...mod,
    ...(await getAdditionalFilesInfo(mod.code)),
  });

  return {
    name: "visualizer",

    async generateBundle(outputOptions: NormalizedOutputOptions, outputBundle: OutputBundle): Promise<void> {
      if (opts.sourcemap && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      const roots: Array<ModuleTree | ModuleTreeLeaf> = [];
      const mapper = new ModuleMapper(projectRoot);
      const links: ModuleLink[] = [];

      // collect trees
      for (const [bundleId, bundle] of Object.entries(outputBundle)) {
        if (bundle.type !== "chunk") continue; //only chunks

        let tree: ModuleTree;

        if (opts.sourcemap) {
          if (!bundle.map) {
            this.warn(WARN_SOURCEMAP_MISSING(bundleId));
          }

          const modules = await getSourcemapModules(
            bundleId,
            bundle,
            outputOptions.dir ?? (outputOptions.file && path.dirname(outputOptions.file)) ?? process.cwd()
          );

          const moduleRenderInfo = await Promise.all(
            Object.values(modules).map(({ id, renderedLength }) => {
              const code = bundle.modules[id]?.code;
              return renderedModuleToInfo(id, { renderedLength, code });
            })
          );

          tree = buildTree(bundleId, moduleRenderInfo, mapper);
        } else {
          const modules = await Promise.all(
            Object.entries(bundle.modules).map(([id, mod]) => renderedModuleToInfo(id, mod))
          );

          tree = buildTree(bundleId, modules, mapper);
        }

        if (tree.children.length === 0) {
          const bundleInfo = await getAdditionalFilesInfo(bundle.code);
          const bundleSizes: ModuleRenderSizes = { ...bundleInfo, renderedLength: bundle.code.length };
          const facadeModuleId = bundle.facadeModuleId ?? `${bundleId}-unknown`;
          const bundleUid = mapper.setValue(bundleId, facadeModuleId, {
            isEntry: true,
            ...bundleSizes,
          });
          const leaf: ModuleTreeLeaf = { name: bundleId, uid: bundleUid };
          roots.push(leaf);
        } else {
          roots.push(tree);
        }
      }

      // after trees we process links (this is mostly for uids)
      for (const [bundleId, bundle] of Object.entries(outputBundle)) {
        if (bundle.type !== "chunk" || bundle.facadeModuleId == null) continue; //only chunks

        addLinks(bundleId, bundle.facadeModuleId, this.getModuleInfo.bind(this), links, mapper);
      }

      const tree = mergeTrees(roots);

      const data: VisualizerData = {
        version,
        tree,
        nodes: mapper.getNodes(),
        nodeParts: mapper.getNodeParts(),
        links,
        env: {
          rollup: this.meta.rollupVersion,
        },
        options: {
          gzip: gzipSize,
          brotli: brotliSize,
          sourcemap: !!opts.sourcemap,
        },
      };

      const fileContent: string = json
        ? JSON.stringify(data, null, 2)
        : await buildHtml({
            title,
            data,
            template,
          });

      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, fileContent);

      if (open) {
        await opn(filename, openOptions);
      }
    },
  };
};

export default visualizer;
