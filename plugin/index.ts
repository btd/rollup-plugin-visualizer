import { promises as fs } from "node:fs";
import path from "node:path";
import { createShareLink } from "./share-link.js";
import { isVisualTemplate } from "../shared/share/url.js";

import {
  BundlerNormalizedOutputOptions,
  BundlerOutputBundle,
  BundlerOutputOptions,
  VisualizerPlugin,
} from "./bundler-types.js";
import opn, { Options as OpenOptions } from "open";

import { ModuleLengths, VisualizerData } from "../shared/types.js";
import { version } from "./version.js";

import { createGzipSizeGetter, createBrotliSizeGetter, SizeGetter } from "./compress.js";

import { TemplateType } from "./template-types.js";
import { replaceHashPlaceholders } from "./module-mapper.js";
import { collectReport, selectReport, buildReport } from "./report.js";
import { renderTemplate } from "./render-template.js";
import type { Filter } from "../shared/create-filter.js";

export type { BundlerOutputOptions, VisualizerPlugin } from "./bundler-types.js";

const WARN_SOURCEMAP_DISABLED =
  "rollup output configuration missing sourcemap = true. You should add output.sourcemap = true or disable sourcemap in this plugin";

const WARN_JSON_DEPRECATED = 'Option `json` deprecated, please use template: "raw-data"';

const WARN_FUNCTION_OPTIONS_DEPRECATED =
  "Passing a function to visualizer() is deprecated. Pass an options object instead.";

const ERR_FILENAME_EMIT = "When using emitFile option, filename must not be path but a filename";

export interface PluginVisualizerOptions {
  /** Write a report file (default), or print a complete static viewer URL. */
  output?: "file" | "link";

  /**
   * The path to the template file to use. Or just a name of a file.
   *
   * Ignored with output: "link".
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
   * If plugin should open browser with the generated file or report link. Ignored when `json` or `emitFile` is true.
   *
   * @default false
   */
  open?: boolean;
  openOptions?: OpenOptions;

  /**
   * Which diagram to generate. 'sunburst' or 'treemap' can help find big dependencies or if they are repeated.
   * 'treemap-3d' renders the same hierarchy as extruded boxes with a 3D camera.
   * 'network' can answer you why something was included.
   * 'flamegraph' will be familar to tools that you know already.
   * 'markdown' generates text report with notes about precision and config.
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
  include?: Filter | Filter[];

  /**
   * A valid picomatch pattern, or array of patterns. If options.include is omitted or has zero length, filter will return true by
   * default. Otherwise, an ID must match one or more of the picomatch patterns, and must not match any of the options.exclude patterns.
   */
  exclude?: Filter | Filter[];
}

const defaultSizeGetter: SizeGetter = () => Promise.resolve(0);

const chooseDefaultFileName = (opts: PluginVisualizerOptions) => {
  if (opts.filename) return opts.filename;

  if (opts.json || opts.template === "raw-data") return "stats.json";

  if (opts.template === "list") return "stats.yml";
  if (opts.template === "markdown") return "stats.md";

  return "stats.html";
};

export function visualizer(pluginOptions?: PluginVisualizerOptions): VisualizerPlugin;
/** @deprecated Pass an options object instead of a function. */
export function visualizer(
  pluginOptions: (outputOptions: BundlerOutputOptions) => PluginVisualizerOptions,
): VisualizerPlugin;
export function visualizer(
  pluginOptions?:
    | PluginVisualizerOptions
    | ((outputOptions: BundlerOutputOptions) => PluginVisualizerOptions),
): VisualizerPlugin;
export function visualizer(
  pluginOptions:
    | PluginVisualizerOptions
    | ((outputOptions: BundlerOutputOptions) => PluginVisualizerOptions) = {},
): VisualizerPlugin {
  let warnedAboutFunctionOptions = false;
  return {
    name: "visualizer",

    async generateBundle(
      outputOptions: BundlerNormalizedOutputOptions,
      outputBundle: BundlerOutputBundle,
    ): Promise<void> {
      if (typeof pluginOptions === "function" && !warnedAboutFunctionOptions) {
        warnedAboutFunctionOptions = true;
        this.warn(WARN_FUNCTION_OPTIONS_DEPRECATED);
      }
      const opts =
        typeof pluginOptions === "function" ? pluginOptions(outputOptions) : pluginOptions;
      const output = opts.output ?? "file";
      if (output !== "file" && output !== "link")
        this.error(`Unknown visualizer output: ${output}`);
      const template = opts.json ? "raw-data" : (opts.template ?? "treemap");
      if (output === "link") {
        if (opts.emitFile) this.error("Link output cannot be combined with emitFile: true.");
        if (!isVisualTemplate(template))
          this.error(
            `Template "${template}" does not support link output. Choose a visual template or file output.`,
          );
      }

      if ("json" in opts) {
        this.warn(WARN_JSON_DEPRECATED);
      }
      const filename = opts.filename ?? chooseDefaultFileName(opts);
      const title = opts.title ?? "Rollup Visualizer";

      const open = !!opts.open;
      const openOptions = opts.openOptions ?? {};

      const projectRoot = opts.projectRoot ?? process.cwd();

      const gzipSizeRequested = !!opts.gzipSize;
      const brotliSizeRequested = !!opts.brotliSize;
      const gzipSize = gzipSizeRequested && !opts.sourcemap;
      const brotliSize = brotliSizeRequested && !opts.sourcemap;
      const gzipSizeGetter = gzipSize
        ? createGzipSizeGetter(typeof opts.gzipSize === "object" ? opts.gzipSize : {})
        : defaultSizeGetter;
      const brotliSizeGetter = brotliSize
        ? createBrotliSizeGetter(typeof opts.brotliSize === "object" ? opts.brotliSize : {})
        : defaultSizeGetter;

      const getModuleLengths = async ({
        id,
        code,
      }: {
        id: string;
        code: string | null;
      }): Promise<ModuleLengths & { id: string }> => {
        const isCodeEmpty = code == null || code == "";

        const result = {
          id,
          gzipLength: isCodeEmpty ? 0 : await gzipSizeGetter(code),
          brotliLength: isCodeEmpty ? 0 : await brotliSizeGetter(code),
          renderedLength: isCodeEmpty ? 0 : Buffer.byteLength(code, "utf-8"),
        };
        return result;
      };

      if (opts.sourcemap && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      const collected = await collectReport(outputBundle, {
        sourcemap: !!opts.sourcemap,
        dir:
          outputOptions.dir ??
          (outputOptions.file && path.dirname(outputOptions.file)) ??
          process.cwd(),
        getModuleInfo: this.getModuleInfo.bind(this),
        warn: this.warn.bind(this),
      });
      const selected = selectReport(collected, opts.include, opts.exclude);
      const report = await buildReport(selected, projectRoot, getModuleLengths);

      const data: VisualizerData = {
        version,
        ...report,
        env: {
          rollup: this.meta.rollupVersion,
        },
        options: {
          gzip: gzipSize,
          brotli: brotliSize,
          sourcemap: !!opts.sourcemap,
        },
      };

      const stringData = replaceHashPlaceholders(data);
      if (output === "link") {
        const url = createShareLink(template, title, JSON.parse(stringData));
        this.info(url);
        if (open) await opn(url, openOptions);
        return;
      }

      const fileContent: string = await renderTemplate(template, {
        title,
        data: stringData,
        reportConfig: {
          sourcemap: !!opts.sourcemap,
          outputSourcemap: !!outputOptions.sourcemap,
          gzipSize: {
            requested: gzipSizeRequested,
            enabled: gzipSize,
          },
          brotliSize: {
            requested: brotliSizeRequested,
            enabled: brotliSize,
          },
          include: opts.include,
          exclude: opts.exclude,
        },
      });

      if (opts.emitFile) {
        // Regex checks for filenames starting with `./`, `../`, `.\` or `..\`
        // to account for windows-style path separators
        if (path.isAbsolute(filename) || /^\.{1,2}[/\\]/.test(filename)) {
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
}

export default visualizer;
