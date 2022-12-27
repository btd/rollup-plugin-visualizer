import { HierarchyRectangularNode } from "d3-hierarchy";
import { ModuleTree, ModuleTreeLeaf } from "../shared/types";

export type CssColor = string;

export const COLOR_DEFAULT_FILE: CssColor = "#db7100";
export const COLOR_DEFAULT_OWN_SOURCE: CssColor = "#487ea4";
export const COLOR_DEFAULT_VENDOR_SOURCE: CssColor = "#599e59";

export const COLOR_BASE: CssColor = "#cecece";

const colorDefault = (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>): CssColor => {
  if (node.children && node.children.length) {
    const parents = node.ancestors();
    const hasNodeModules = parents.some(({ data: { name } }) => name === "node_modules");
    return hasNodeModules ? COLOR_DEFAULT_VENDOR_SOURCE : COLOR_DEFAULT_OWN_SOURCE;
  } else {
    return COLOR_DEFAULT_FILE;
  }
};

export default colorDefault;
