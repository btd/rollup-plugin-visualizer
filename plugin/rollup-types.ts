// Structural stubs for rollup/rolldown types. Both bundlers are optional peer
// deps, so the published .d.ts files can't hard-import from either.

export interface OutputOptions {
  dir?: string;
  file?: string;
  format?: any;
  name?: string;
  entryFileNames?: string | ((chunkInfo: any) => string);
  chunkFileNames?: string | ((chunkInfo: any) => string);
  assetFileNames?: string | ((assetInfo: any) => string);
  sourcemap?: boolean | "inline" | "hidden";
  banner?: any;
  footer?: any;
  intro?: any;
  outro?: any;
  globals?: any;
  exports?: "auto" | "default" | "named" | "none";
}

export interface Plugin {
  name: string;
  generateBundle?: (
    this: any,
    options: any,
    bundle: any,
    isWrite?: boolean,
  ) => void | Promise<void>;
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
