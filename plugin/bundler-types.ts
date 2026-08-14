// Minimal structural stand-ins for the bundler types this plugin touches.
//
// The plugin supports rollup, rolldown and vite. Importing types from any one of
// them would force that bundler to be installed just to typecheck: vite 8 depends
// on rolldown and no longer ships rollup at all, so an `import ... from "rollup"`
// in the published .d.ts resolves to nothing for most consumers (silently `any`
// under skipLibCheck, a hard TS2307 without it).
//
// These interfaces intentionally describe only what the plugin reads, which makes
// them structural *supertypes* of the real rollup/rolldown/vite types. That is
// what makes a single definition satisfy all of them, across bundler versions.
//
// IMPORTANT: never make a member narrower or more specific than the real thing.
// Widening a field (e.g. `format?: string` where rollup has a `ModuleFormat`
// union) breaks assignability just as surely as adding a required member does.
// test/types/assignability.ts asserts this against every supported bundler.

export interface BundlerModuleInfo {
  isEntry: boolean;
  /** rollup only — rolldown (and therefore vite 8) does not provide this. */
  isExternal?: boolean;
  importedIds: readonly string[];
  dynamicallyImportedIds?: readonly string[];
}

export type GetModuleInfo = (moduleId: string) => BundlerModuleInfo | null;

export interface BundlerPluginContext {
  meta: { rollupVersion: string };
  warn(log: string): void;
  error(err: string): never;
  emitFile(file: { type: "asset"; fileName: string; source: string }): string;
  getModuleInfo: GetModuleInfo;
}

export interface BundlerRenderedModule {
  readonly code: string | null;
  renderedLength: number;
}

export interface BundlerOutputChunk {
  type: "chunk";
  code: string;
  /** `unknown` because rollup and rolldown model source maps differently. */
  map?: unknown;
  modules: Record<string, BundlerRenderedModule>;
  facadeModuleId: string | null;
}

export interface BundlerOutputAsset {
  type: "asset";
}

export type BundlerOutputBundle = Record<string, BundlerOutputChunk | BundlerOutputAsset>;

/** Only the members this plugin reads; see the note above about widening. */
export interface BundlerOutputOptions {
  sourcemap?: boolean | "inline" | "hidden";
  dir?: string;
  file?: string;
}

export interface BundlerNormalizedOutputOptions {
  sourcemap: boolean | "inline" | "hidden";
  dir?: string;
  file?: string;
}

export interface VisualizerPlugin {
  name: string;
  generateBundle(
    this: BundlerPluginContext,
    outputOptions: BundlerNormalizedOutputOptions,
    outputBundle: BundlerOutputBundle,
  ): Promise<void>;
}
