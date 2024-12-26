import { createContext, render } from "preact";
import { hierarchy, HierarchyNode, treemap, TreemapLayout, treemapResquarify } from "d3-hierarchy";
import {
  isModuleTree,
  ModuleLengths,
  ModuleTree,
  ModuleTreeLeaf,
  SizeKey,
  VisualizerData,
} from "../../shared/types";

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

export interface ChartData {
  layout: TreemapLayout<ModuleTree | ModuleTreeLeaf>;
  rawHierarchy: HierarchyNode<ModuleTree | ModuleTreeLeaf>;
  getModuleSize: (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) => number;
  getModuleIds: (node: ModuleTree | ModuleTreeLeaf) => ModuleIds;
  getModuleColor: NodeColorGetter;
}

export type Context = StaticData & ChartData;

export const StaticContext = createContext<Context>({} as unknown as Context);

const drawChart = (
  parentNode: Element,
  data: VisualizerData,
  width: number,
  height: number,
): void => {
  const availableSizeProperties = getAvailableSizeOptions(data.options);

  console.time("layout create");

  const layout = treemap<ModuleTree | ModuleTreeLeaf>()
    .size([width, height])
    .paddingOuter(PADDING)
    .paddingTop(TOP_PADDING)
    .paddingInner(PADDING)
    .round(true)
    .tile(treemapResquarify);

  console.timeEnd("layout create");

  console.time("rawHierarchy create");
  const rawHierarchy = hierarchy<ModuleTree | ModuleTreeLeaf>(data.tree);
  console.timeEnd("rawHierarchy create");

  const nodeSizesCache = new Map<ModuleTree | ModuleTreeLeaf, ModuleLengths>();

  const nodeIdsCache = new Map<ModuleTree | ModuleTreeLeaf, ModuleIds>();

  const getModuleSize = (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) =>
    nodeSizesCache.get(node)?.[sizeKey] ?? 0;

  console.time("rawHierarchy eachAfter cache");
  rawHierarchy.eachAfter((node) => {
    const nodeData = node.data;

    nodeIdsCache.set(nodeData, {
      nodeUid: generateUniqueId("node"),
      clipUid: generateUniqueId("clip"),
    });

    const sizes: ModuleLengths = { renderedLength: 0, gzipLength: 0, brotliLength: 0 };
    if (isModuleTree(nodeData)) {
      for (const sizeKey of availableSizeProperties) {
        sizes[sizeKey] = nodeData.children.reduce(
          (acc, child) => getModuleSize(child, sizeKey) + acc,
          0,
        );
      }
    } else {
      for (const sizeKey of availableSizeProperties) {
        sizes[sizeKey] = data.nodeParts[nodeData.uid][sizeKey] ?? 0;
      }
    }
    nodeSizesCache.set(nodeData, sizes);
  });
  console.timeEnd("rawHierarchy eachAfter cache");

  const getModuleIds = (node: ModuleTree | ModuleTreeLeaf) => nodeIdsCache.get(node) as ModuleIds;

  console.time("color");
  const getModuleColor = createRainbowColor(rawHierarchy);
  console.timeEnd("color");

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
      }}
    >
      <Main />
    </StaticContext.Provider>,
    parentNode,
  );
};

export default drawChart;
