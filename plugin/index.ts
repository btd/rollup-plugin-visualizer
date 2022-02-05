import { promises as fs } from "fs";
import path from "path";

import { OutputBundle, Plugin, NormalizedOutputOptions } from "rollup";
import opn from "open";

import { ModuleLengths, ModuleTree, ModuleTreeLeaf, VisualizerData } from "../types/types";
import { version } from "./version";

import { createGzipSizeGetter, createBrotliSizeGetter, SizeGetter } from "./compress";

import { TemplateType } from "./template-types";
import { ModuleMapper } from "./module-mapper";
import { addLinks, buildTree, mergeTrees } from "./data";
import { getSourcemapModules } from "./sourcemap";
import { buildHtml } from "./build-stats";

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

  const ModuleLengths = async ({
    id,
    renderedLength,
    code,
  }: {
    id: string;
    renderedLength: number;
    code: string | null;
  }): Promise<ModuleLengths & { id: string }> => {
    const result = {
      id,
      gzipLength: code == null || code == "" ? 0 : await gzipSizeGetter(code),
      brotliLength: code == null || code == "" ? 0 : await brotliSizeGetter(code),
      renderedLength: code == null || code == "" ? renderedLength : Buffer.byteLength(code, "utf-8"),
    };
    return result;
  };

  return {
    name: "visualizer",

    async generateBundle(outputOptions: NormalizedOutputOptions, outputBundle: OutputBundle): Promise<void> {
      if (opts.sourcemap && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      const roots: Array<ModuleTree | ModuleTreeLeaf> = [];
      const mapper = new ModuleMapper(projectRoot);

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
              return ModuleLengths({ id, renderedLength, code });
            })
          );

          tree = buildTree(bundleId, moduleRenderInfo, mapper);
        } else {
          const modules = await Promise.all(
            Object.entries(bundle.modules).map(([id, { renderedLength, code }]) =>
              ModuleLengths({ id, renderedLength, code })
            )
          );

          tree = buildTree(bundleId, modules, mapper);
        }

        if (tree.children.length === 0) {
          const bundleSizes = await ModuleLengths({
            id: bundleId,
            renderedLength: bundle.code.length,
            code: bundle.code,
          });

          const facadeModuleId = bundle.facadeModuleId ?? `${bundleId}-unknown`;
          const bundleUid = mapper.setNodePart(bundleId, facadeModuleId, bundleSizes);
          mapper.setNodeMeta(facadeModuleId, { isEntry: true });
          const leaf: ModuleTreeLeaf = { name: bundleId, uid: bundleUid, bundle: bundleId };
          roots.push(leaf);
        } else {
          roots.push(tree);
        }
      }

      // after trees we process links (this is mostly for uids)
      for (const [, bundle] of Object.entries(outputBundle)) {
        if (bundle.type !== "chunk" || bundle.facadeModuleId == null) continue; //only chunks

        addLinks(bundle.facadeModuleId, this.getModuleInfo.bind(this), mapper);
      }

      const tree = mergeTrees(roots);

      const data: VisualizerData = {
        version,
        tree,
        nodeParts: mapper.getNodeParts(),
        nodeMetas: mapper.getNodeMetas(),
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
