export type SizeKey = "renderedLength" | "gzipLength" | "brotliLength";

export const isModuleTree = (mod: ModuleTree | ModuleTreeLeaf): mod is ModuleTree => "children" in mod;

export type ModuleUID = string;
export interface ModuleTreeLeaf {
  name: string;
  uid: ModuleUID;
}

export interface ModuleTree {
  name: string;
  children: Array<ModuleTree | ModuleTreeLeaf>;
}

export type ModuleRenderInfo = {
  id: string;
  isEntry?: boolean;
  isExternal?: boolean;
} & ModuleRenderSizes;

export interface ModuleRenderSizes {
  renderedLength: number;
  gzipLength?: number;
  brotliLength?: number;
}

export interface ModuleLink {
  source: ModuleUID;
  target: ModuleUID;
  dynamic?: boolean;
}

export interface VisualizerData {
  version: number;
  tree: ModuleTree;
  nodes: Record<ModuleUID, ModuleRenderInfo>;
  nodeParts: Record<ModuleUID, Record<string, ModuleUID>>;
  links: ModuleLink[];
  env: {
    [key: string]: unknown;
  };
  options: {
    gzip: boolean;
    brotli: boolean;
    sourcemap: boolean;
  };
}
