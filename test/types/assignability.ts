// Compile-time only: asserts the plugin's own types stay assignable to every
// bundler we support, without the plugin importing any of them.
//
// This file is never executed. It is checked by `npm run test:types`, which runs
// tsc against test/types/tsconfig.json. If it fails, a member of
// plugin/bundler-types.ts has drifted narrower than the real bundler type.
//
// To sanity check that these assertions still have teeth, break one on purpose
// (e.g. rename `rollupVersion` in BundlerPluginContext) and confirm tsc fails.

import type { OutputOptions as RollupOutputOptions, Plugin as RollupPlugin } from "rollup";
import type {
  OutputOptions as RolldownOutputOptions,
  Plugin as RolldownPlugin,
  RolldownPluginOption,
} from "rolldown";
import type { Plugin as VitePlugin, PluginOption as VitePluginOption } from "vite";

import { visualizer } from "../../plugin/index.js";

const plugin = visualizer();

// the plugin object itself
export const asRollup: RollupPlugin = plugin;
export const asRolldown: RolldownPlugin = plugin;
export const asVite: VitePlugin = plugin;

// how it is actually used: dropped into a bundler's `plugins` array
export const rollupPlugins: RollupPlugin[] = [plugin];
export const rolldownPlugins: RolldownPluginOption[] = [plugin];
export const vitePlugins: VitePluginOption[] = [plugin];

// the option-callback form, both inferred and annotated with each bundler's own type
export const inferred = visualizer((o) => ({ filename: o.dir ?? "stats.html" }));
export const annotatedRollup = visualizer((o: RollupOutputOptions) => ({ filename: o.dir }));
export const annotatedRolldown = visualizer((o: RolldownOutputOptions) => ({ filename: o.dir }));
