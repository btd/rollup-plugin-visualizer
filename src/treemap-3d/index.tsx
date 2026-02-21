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

import { getAvailableSizeOptions } from "../sizes";
import { Main } from "./main";
import createRainbowColor, { NodeColorGetter } from "../treemap/color";

import "../style/style-treemap-3d.scss";

const TOP_PADDING = 20;
const PADDING = 2;

export interface StaticData {
  data: VisualizerData;
  availableSizeProperties: SizeKey[];
  width: number;
  height: number;
}

export interface ChartData {
  layout: TreemapLayout<ModuleTree | ModuleTreeLeaf>;
  rawHierarchy: HierarchyNode<ModuleTree | ModuleTreeLeaf>;
  getModuleSize: (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) => number;
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

  const layout = treemap<ModuleTree | ModuleTreeLeaf>()
    .size([width, height])
    .paddingOuter(PADDING)
    .paddingTop(TOP_PADDING)
    .paddingInner(PADDING)
    .round(true)
    .tile(treemapResquarify);

  const rawHierarchy = hierarchy<ModuleTree | ModuleTreeLeaf>(data.tree);

  const nodeSizesCache = new Map<ModuleTree | ModuleTreeLeaf, ModuleLengths>();

  const getModuleSize = (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) =>
    nodeSizesCache.get(node)?.[sizeKey] ?? 0;

  rawHierarchy.eachAfter((node) => {
    const nodeData = node.data;

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

  const getModuleColor = createRainbowColor(rawHierarchy);

  render(
    <StaticContext.Provider
      value={{
        data,
        availableSizeProperties,
        width,
        height,
        getModuleSize,
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
