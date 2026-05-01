/**
 * Local structural type stubs for rollup/rolldown.
 *
 * `rollup` and `rolldown` are declared as *optional* peer dependencies, so the
 * published `.d.ts` files cannot hard-import from either package — that would
 * force consumers using only one bundler to also install the other (~1 MB plus
 * native binaries) just to satisfy TypeScript.
 *
 * These minimal interfaces describe only what the visualizer plugin actually
 * exposes in its public API or consumes internally. They are intentionally
 * structural subsets of the corresponding `rollup` and `rolldown` types — both
 * of which export `Plugin`, `OutputOptions`, `OutputChunk`, and
 * `GetModuleInfo` with compatible shapes — so the plugin object the visualizer
 * returns is assignable to either bundler's `plugins` array.
 *
 * If you need richer typing for output options inside an options factory or
 * for a particular hook, cast to the relevant bundler's type in your own code.
 */

export interface OutputOptions {
  dir?: string;
  file?: string;
  format?: string;
  name?: string;
  entryFileNames?: string | ((chunkInfo: any) => string);
  chunkFileNames?: string | ((chunkInfo: any) => string);
  assetFileNames?: string | ((assetInfo: any) => string);
  sourcemap?: boolean | "inline" | "hidden";
  banner?: unknown;
  footer?: unknown;
  intro?: unknown;
  outro?: unknown;
  globals?: unknown;
  exports?: "auto" | "default" | "named" | "none";
}

export interface Plugin {
  name: string;
  generateBundle?: (
    this: any,
    options: any,
    bundle: any,
    isWrite?: boolean,
  ) => unknown | Promise<unknown>;
}

export interface OutputChunk {
  type: "chunk";
  code: string;
  map?: unknown;
  facadeModuleId?: string | null;
  modules: Record<string, { renderedLength: number; code: string | null }>;
}

export type GetModuleInfo = (moduleId: string) => {
  isEntry: boolean;
  isExternal: boolean;
  importedIds: readonly string[];
  dynamicallyImportedIds?: readonly string[];
} | null;
