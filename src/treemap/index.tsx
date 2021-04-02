import { createContext, render } from "preact";
import { hierarchy, HierarchyNode, treemap, TreemapLayout, treemapResquarify } from "d3-hierarchy";
import {
  isModuleTree,
  ModuleRenderInfo,
  ModuleRenderSizes,
  ModuleTree,
  ModuleTreeLeaf,
  ModuleUID,
  SizeKey,
  VisualizerData,
} from "../../types/types";

import { Main } from "./main";

import { generateUniqueId, Id } from "../uid";
import { getAvailableSizeOptions } from "../sizes";
import createRainbowColor, { NodeColorGetter } from "./color";

import "../style/style-treemap.scss";

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

export type LinkInfo = ModuleRenderInfo & { uid: ModuleUID };
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
    .paddingOuter(5)
    .paddingTop(20)
    .paddingInner(5)
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
    if (!importedByCache.has(target)) {
      importedByCache.set(target, []);
    }
    if (!importedCache.has(source)) {
      importedCache.set(source, []);
    }

    importedByCache.get(target)?.push({ uid: source, ...data.nodes[source] });
    importedCache.get(source)?.push({ uid: target, ...data.nodes[target] });
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
