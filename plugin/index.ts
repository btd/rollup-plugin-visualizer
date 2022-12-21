import { promises as fs } from "fs";
import path from "path";

import { OutputBundle, Plugin, NormalizedOutputOptions, OutputOptions } from "rollup";
import opn from "open";

import { createFilter, FilterPattern } from "@rollup/pluginutils";

import { ModuleLengths, ModuleTree, ModuleTreeLeaf, VisualizerData } from "../types/types";
import { version } from "./version";

import { createGzipSizeGetter, createBrotliSizeGetter, SizeGetter } from "./compress";

import { TemplateType } from "./template-types";
import { ModuleMapper } from "./module-mapper";
import { addLinks, buildTree, mergeTrees } from "./data";
import { getSourcemapModules } from "./sourcemap";
import { renderTemplate } from "./render-template";

const WARN_SOURCEMAP_DISABLED =
  "rollup output configuration missing sourcemap = true. You should add output.sourcemap = true or disable sourcemap in this plugin";

const WARN_SOURCEMAP_MISSING = (id: string) => `${id} missing source map`;

const WARN_JSON_DEPRECATED = 'Option `json` deprecated, please use template: "raw-data"';

const ERR_FILENAME_EMIT = "When using emitFile option, filename must not be path but a filename";

export interface PluginVisualizerOptions {
  /**
   * The path to the template file to use. Or just a name of a file.
   *
   * @default "stats.html"
   */
  filename?: string;

  /**
   * If plugin should emit json file with visualizer data. It can be used with plugin CLI
   *
   * @default false
   * @deprecated use template 'raw-data'
   */
  json?: boolean;

  /**
   * HTML <title> value in generated file. Ignored when `json` is true.
   *
   * @default "Rollup Visualizer"
   */
  title?: string;

  /**
   * If plugin should open browser with generated file. Ignored when `json` is true.
   *
   * @default false
   */
  open?: boolean;
  openOptions?: opn.Options;

  /**
   * Which diagram to generate. 'sunburst' or 'treemap' can help find big dependencies or if they are repeated.
   * 'network' can answer you why something was included
   *
   * @default 'treemap'
   */
  template?: TemplateType;

  /**
   * If plugin should also calculate sizes of gzipped files.
   *
   * @default false
   */
  gzipSize?: boolean;

  /**
   * If plugin should also calculate sizes of brotlied files.
   *
   * @default false
   */
  brotliSize?: boolean;

  /**
   * If plugin should use sourcemap to calculate sizes of modules. By idea it will present more accurate results.
   * `gzipSize` and `brotliSize` does not make much sense with this option.
   *
   * @default false
   */
  sourcemap?: boolean;

  /**
   * Absolute path where project is located. It is used to cut prefix from file's paths.
   *
   * @default process.cwd()
   */
  projectRoot?: string | RegExp;

  /**
   * Use rollup .emitFile API to generate files. Could be usefull if you want to output to configured by rollup output dir.
   * When this set to true, filename options must be filename and not a path.
   *
   * @default false
   */
  emitFile?: boolean;

  /**
   * A valid picomatch pattern, or array of patterns. If options.include is omitted or has zero length, filter will return true by 
   * default. Otherwise, an ID must match one or more of the picomatch patterns, and must not match any of the options.exclude patterns.
   */
  include?: FilterPattern;

  /**
   * A valid picomatch pattern, or array of patterns. If options.include is omitted or has zero length, filter will return true by 
   * default. Otherwise, an ID must match one or more of the picomatch patterns, and must not match any of the options.exclude patterns.
   */
  exclude?: FilterPattern;
}

const defaultSizeGetter: SizeGetter = () => Promise.resolve(0);

const chooseDefaultFileName = (opts: PluginVisualizerOptions) => {
  if (opts.filename) return opts.filename;

  if (opts.json || opts.template === "raw-data") return "stats.json";

  if (opts.template === "list") return "stats.yml";

  return "stats.html";
};

export const visualizer = (
  opts: PluginVisualizerOptions | ((outputOptions: OutputOptions) => PluginVisualizerOptions) = {}
): Plugin => {
  return {
    name: "visualizer",

    async generateBundle(
      outputOptions: NormalizedOutputOptions,
      outputBundle: OutputBundle
    ): Promise<void> {
      opts = typeof opts === "function" ? opts(outputOptions) : opts;

      if ("json" in opts) {
        this.warn(WARN_JSON_DEPRECATED);
        if (opts.json) opts.template = "raw-data";
      }
      const filename = opts.filename ?? chooseDefaultFileName(opts);
      const title = opts.title ?? "Rollup Visualizer";

      const open = !!opts.open;
      const openOptions = opts.openOptions ?? {};

      const template = opts.template ?? "treemap";
      const projectRoot = opts.projectRoot ?? process.cwd();

      const filter = createFilter(opts.include, opts.exclude, {
        resolve: typeof projectRoot === "string" ? projectRoot : process.cwd(),
      });

      const gzipSize = !!opts.gzipSize && !opts.sourcemap;
      const brotliSize = !!opts.brotliSize && !opts.sourcemap;
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
  
        const isCodeEmpty = code == null || code == "";

        const result = {
          id,
          gzipLength: isCodeEmpty ? 0 : await gzipSizeGetter(code),
          brotliLength: isCodeEmpty ? 0 : await brotliSizeGetter(code),
          renderedLength: isCodeEmpty ? renderedLength : Buffer.byteLength(code, "utf-8"),
        };
        return result;
      };

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
            outputOptions.dir ??
              (outputOptions.file && path.dirname(outputOptions.file)) ??
              process.cwd()
          );

          const moduleRenderInfo = await Promise.all(
            Object.values(modules)
            .filter(({ id }) => filter(id))
            .map(({ id, renderedLength }) => {
              const code = bundle.modules[id]?.code;
              return ModuleLengths({ id, renderedLength, code });
            })
          );

          tree = buildTree(bundleId, moduleRenderInfo, mapper);
        } else {
          const modules = await Promise.all(
            Object.entries(bundle.modules)
            .filter(([ id ]) => filter(id))
            .map(([id, { renderedLength, code }]) =>
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
          const leaf: ModuleTreeLeaf = { name: bundleId, uid: bundleUid };
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

      const fileContent: string = await renderTemplate(template, {
        title,
        data,
      });

      if (opts.emitFile) {
        if (path.isAbsolute(filename) || filename.startsWith(".")) {
          this.error(ERR_FILENAME_EMIT);
        }
        this.emitFile({
          type: "asset",
          fileName: filename,
          source: fileContent,
        });
      } else {
        await fs.mkdir(path.dirname(filename), { recursive: true });
        await fs.writeFile(filename, fileContent);

        if (open) {
          await opn(filename, openOptions);
        }
      }
    },
  };
};

export default visualizer;
