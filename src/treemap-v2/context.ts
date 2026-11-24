import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { HierarchyNode } from "d3-hierarchy";
import type { NodeColor } from "./color";
import type { OutputNode } from "./data";

interface RenderContext {
  width: number;
  height: number;
  getModuleColor: (node: HierarchyNode<OutputNode>) => NodeColor;
}

export const TreeMapContext = createContext<RenderContext | undefined>(undefined);
export function useTreeMapContext(): RenderContext {
  const context = useContext(TreeMapContext);
  if (!context) throw new Error("Missing treemap rendering context");
  return context;
}
