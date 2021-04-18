import { createContext, render } from "preact";
import { hierarchy, HierarchyNode, treemap, TreemapLayout, treemapResquarify } from "d3-hierarchy";
import {
  isModuleTree,
  ModuleRenderSizes,
  ModuleTree,
  ModuleTreeLeaf,
  ModuleUID,
  SizeKey,
  VisualizerData,
} from "../../types/types";

import { generateUniqueId, Id } from "../uid";
import { getAvailableSizeOptions } from "../sizes";
import { Main } from "./main";
import createRainbowColor, { NodeColorGetter } from "./color";

import "../style/style-treemap.scss";
import { PADDING, TOP_PADDING } from "./const";

export interface StaticData {
  data: VisualizerData;
  availableSizeProperties: SizeKey[];
  width: number;
  height: number;
}

export interface ModuleIds {
  nodeUid: Id;
  clipUid: Id;
}

export type LinkInfo = {
  id: string;
};
export type ModuleLinkInfo = Map<ModuleUID, LinkInfo[]>;
export interface ChartData {
  layout: TreemapLayout<ModuleTree | ModuleTreeLeaf>;
  rawHierarchy: HierarchyNode<ModuleTree | ModuleTreeLeaf>;
  getModuleSize: (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) => number;
  getModuleIds: (node: ModuleTree | ModuleTreeLeaf) => ModuleIds;
  getModuleColor: NodeColorGetter;
  importedCache: ModuleLinkInfo;
  importedByCache: ModuleLinkInfo;
}

export type Context = StaticData & ChartData;

export const StaticContext = createContext<Context>(({} as unknown) as Context);

const drawChart = (parentNode: Element, data: VisualizerData, width: number, height: number): void => {
  const availableSizeProperties = getAvailableSizeOptions(data.options);

  const layout = treemap<ModuleTree | ModuleTreeLeaf>()
    .size([width, height])
    .paddingOuter(PADDING)
    .paddingTop(TOP_PADDING)
    .paddingInner(PADDING)
    .round(true)
    .tile(treemapResquarify);

  const rawHierarchy = hierarchy<ModuleTree | ModuleTreeLeaf>(data.tree);

  const nodeSizesCache = new Map<ModuleTree | ModuleTreeLeaf, ModuleRenderSizes>();

  const nodeIdsCache = new Map<ModuleTree | ModuleTreeLeaf, ModuleIds>();

  const getModuleSize = (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) =>
    nodeSizesCache.get(node)?.[sizeKey] ?? 0;

  rawHierarchy.eachAfter((node) => {
    const nodeData = node.data;

    nodeIdsCache.set(nodeData, {
      nodeUid: generateUniqueId("node"),
      clipUid: generateUniqueId("clip"),
    });

    const sizes: ModuleRenderSizes = { renderedLength: 0 };
    if (isModuleTree(nodeData)) {
      for (const sizeKey of availableSizeProperties) {
        sizes[sizeKey] = nodeData.children.reduce((acc, child) => getModuleSize(child, sizeKey) + acc, 0);
      }
    } else {
      for (const sizeKey of availableSizeProperties) {
        sizes[sizeKey] = data.nodes[nodeData.uid][sizeKey] ?? 0;
      }
    }
    nodeSizesCache.set(nodeData, sizes);
  });

  const getModuleIds = (node: ModuleTree | ModuleTreeLeaf) => nodeIdsCache.get(node) as ModuleIds;

  const getModuleColor = createRainbowColor(rawHierarchy);

  const importedByCache = new Map<ModuleUID, LinkInfo[]>();
  const importedCache = new Map<ModuleUID, LinkInfo[]>();

  for (const { source, target } of data.links) {
    for (const sourceUid of Object.values(data.nodeParts[source])) {
      if (!importedCache.has(sourceUid)) {
        importedCache.set(sourceUid, []);
      }

      for (const targetUid of Object.values(data.nodeParts[target])) {
        if (!importedByCache.has(targetUid)) {
          importedByCache.set(targetUid, []);
        }

        importedByCache.get(targetUid)?.push(data.nodes[sourceUid]);
        importedCache.get(sourceUid)?.push(data.nodes[targetUid]);
      }
    }
  }

  render(
    <StaticContext.Provider
      value={{
        data,
        availableSizeProperties,
        width,
        height,
        getModuleSize,
        getModuleIds,
        getModuleColor,
        rawHierarchy,
        layout,
        importedCache,
        importedByCache,
      }}
    >
      <Main />
    </StaticContext.Provider>,
    parentNode
  );
};

export default drawChart;
