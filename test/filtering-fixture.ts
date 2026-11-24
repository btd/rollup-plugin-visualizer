import path from "node:path";
import { rollup, type OutputOptions } from "rollup";
import {
  rolldown,
  type RolldownPlugin,
  type OutputOptions as RolldownOutputOptions,
} from "rolldown";
import { build } from "vite";
import type { RawSourceMap } from "source-map";
import { visualizer, type PluginVisualizerOptions } from "../dist/plugin/index.js";
import type {
  BundlerOutputBundle,
  BundlerNormalizedOutputOptions,
  BundlerPluginContext,
} from "../plugin/bundler-types";
import type { VisualizerData } from "../shared/types";

export const FILTER_ROOT = "/filtering/";
export const FILTER_ENTRY = `${FILTER_ROOT}src/入口😀.js`;
export const FILTER_HTML = ["treemap", "treemap-v2", "treemap-3d", "sunburst", "flamegraph", "network"] as const;
export const packageExclusions = ["date-fns", "lodash-es", "lucide-react"].map((name) => ({
  file: `**/node_modules/${name}/**`,
}));

export const filteringFiles = {
  [FILTER_ENTRY]: `
    import { bridge } from '../node_modules/date-fns/index.js';
    import { value as lodash } from '../node_modules/lodash-es/index.js';
    import { value as lucide } from '../node_modules/lucide-react/index.js';
    import { local } from './keep.js';
    import { unused } from './unused.js';
    import './empty.js';
    import external from 'external-dep';
    console.log(bridge(), lodash, lucide, local(), external);
    import('./lazy.js').then(m => m.lazy());
  `,
  [`${FILTER_ROOT}node_modules/date-fns/index.js`]: `
    import { kept } from '../kept-util/index.js';
    export const bridge = () => kept() + Math.random();
  `,
  [`${FILTER_ROOT}node_modules/lodash-es/index.js`]: "export const value = Math.random();",
  [`${FILTER_ROOT}node_modules/lucide-react/index.js`]: "export const value = Math.random();",
  [`${FILTER_ROOT}node_modules/kept-util/index.js`]: "export const kept = () => Math.random();",
  [`${FILTER_ROOT}src/keep.js`]: "export const local = () => 'é😀' + Math.random();",
  [`${FILTER_ROOT}src/unused.js`]: "export const unused = 42;",
  [`${FILTER_ROOT}src/empty.js`]: "export {};",
  [`${FILTER_ROOT}src/lazy.js`]: `
    import { kept } from '../node_modules/kept-util/index.js';
    export const lazy = () => console.log(kept());
  `,
};

export interface FilteringFixtureOptions {
  visualizer?: PluginVisualizerOptions;
  templates?: PluginVisualizerOptions["template"][];
  files?: Record<string, string>;
  input?: string | Record<string, string>;
  sourcemap?: boolean;
  maps?: Record<string, RawSourceMap>;
  withoutAttribution?: "map" | "modules" | "empty-map";
}

export const generateFilteredReport = async (
  bundler: "rollup" | "rolldown" | "vite",
  options: FilteringFixtureOptions = {},
) => {
  const files: Record<string, string> = options.files ?? filteringFiles;
  const sourcemap = options.sourcemap ?? false;
  const input = options.input ?? { entry: FILTER_ENTRY };
  const chunks = new Map<
    string,
    { code: string; modules: string[]; facadeModuleId: string | null }
  >();
  const warnings: string[] = [];
  const plugins = [
    {
      name: "filtering-fixture",
      resolveId(id: string, importer?: string) {
        if (id.startsWith(".")) {
          const resolved = path.posix.resolve(path.posix.dirname(importer!), id);
          return resolved in files ? resolved : null;
        }
        return id in files ? id : null;
      },
      load(id: string) {
        if (!(id in files)) return null;
        return options.maps?.[id] ? { code: files[id], map: options.maps[id] } : files[id];
      },
    },
    ...[...new Set(["raw-data" as const, ...(options.templates ?? [])])].map((template) => {
      const plugin = visualizer({
        sourcemap,
        projectRoot: FILTER_ROOT,
        ...options.visualizer,
        template,
        filename: `${template}.report`,
        emitFile: true,
      });
      return {
        name: plugin.name,
        generateBundle(
          this: BundlerPluginContext,
          outputOptions: BundlerNormalizedOutputOptions,
          bundle: BundlerOutputBundle,
        ) {
          const reportBundle: BundlerOutputBundle = {};
          for (const [id, original] of Object.entries(bundle)) {
            if (original.type !== "chunk") continue;
            // Strip attribution on a copy of real bundler output. Rolldown does
            // not persist changes to chunk.modules between generateBundle hooks.
            const chunk = { ...original };
            if (options.withoutAttribution === "modules") chunk.modules = {};
            if (options.withoutAttribution === "map" || options.withoutAttribution === "modules") {
              chunk.map = null;
            } else if (options.withoutAttribution === "empty-map") {
              chunk.map = { version: 3, sources: [], names: [], mappings: "" };
            }
            reportBundle[id] = chunk;
            chunks.set(id, {
              code: chunk.code,
              modules: Object.keys(chunk.modules),
              facadeModuleId: chunk.facadeModuleId,
            });
          }
          return plugin.generateBundle.call(this, outputOptions, reportBundle);
        },
      };
    }),
  ];
  const outputOptions = {
    format: "es" as const,
    dir: `${FILTER_ROOT}dist`,
    entryFileNames: "[name].js",
    chunkFileNames: "[name].js",
    sourcemap,
  };
  const inputOptions = {
    input,
    external: ["external-dep"],
    plugins,
    onwarn(warning: { message: string }) {
      warnings.push(warning.message);
    },
  };
  let output;
  if (bundler === "vite") {
    const result = await build({
      configFile: false,
      root: FILTER_ROOT,
      publicDir: false,
      logLevel: "silent",
      plugins,
      build: {
        write: false,
        minify: false,
        sourcemap,
        rolldownOptions: {
          input,
          external: inputOptions.external,
          output: outputOptions,
        },
      },
    });
    if (Array.isArray(result) || !("output" in result)) throw new Error("Expected one Vite output");
    output = result.output;
  } else {
    const bundle =
      bundler === "rollup"
        ? await rollup(inputOptions)
        : await rolldown({ ...inputOptions, plugins: plugins as RolldownPlugin[] });
    try {
      output = (await bundle.generate(outputOptions as OutputOptions & RolldownOutputOptions))
        .output;
    } finally {
      await bundle.close();
    }
  }
  const reports = Object.fromEntries(
    output.flatMap((file) =>
      file.type === "asset" && file.fileName.endsWith(".report")
        ? [[file.fileName.slice(0, -".report".length), String(file.source)]]
        : [],
    ),
  );
  if (!reports["raw-data"]) throw new Error("Missing raw-data report");
  return { data: JSON.parse(reports["raw-data"]) as VisualizerData, reports, chunks, warnings };
};
