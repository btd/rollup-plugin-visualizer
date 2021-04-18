import { createContext, render } from "preact";
import { hierarchy, HierarchyNode, HierarchyRectangularNode, partition, PartitionLayout } from "d3-hierarchy";
import { Arc, arc as d3arc } from "d3-shape";
import { scaleLinear, scaleSqrt } from "d3-scale";

import {
  isModuleTree,
  ModuleRenderSizes,
  ModuleTree,
  ModuleTreeLeaf,
  SizeKey,
  VisualizerData,
} from "../../types/types";

import { getAvailableSizeOptions } from "../sizes";
import { generateUniqueId, Id } from "../uid";
import { Main } from "./main";

import "../style/style-sunburst.scss";

export interface StaticData {
  data: VisualizerData;
  availableSizeProperties: SizeKey[];
  width: number;
  height: number;
}

export interface ModuleIds {
  nodeUid: Id;
}

export interface ChartData {
  layout: PartitionLayout<ModuleTree | ModuleTreeLeaf>;
  rawHierarchy: HierarchyNode<ModuleTree | ModuleTreeLeaf>;
  getModuleSize: (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) => number;
  getModuleIds: (node: ModuleTree | ModuleTreeLeaf) => ModuleIds;
  size: number;
  radius: number;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arc: Arc<any, HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>>;
}

export type Context = StaticData & ChartData;

export const StaticContext = createContext<Context>(({} as unknown) as Context);

const drawChart = (parentNode: Element, data: VisualizerData, width: number, height: number): void => {
  const availableSizeProperties = getAvailableSizeOptions(data.options);

  const layout = partition<ModuleTree | ModuleTreeLeaf>();

  const rawHierarchy = hierarchy<ModuleTree | ModuleTreeLeaf>(data.tree);

  const nodeSizesCache = new Map<ModuleTree | ModuleTreeLeaf, ModuleRenderSizes>();

  const nodeIdsCache = new Map<ModuleTree | ModuleTreeLeaf, ModuleIds>();

  const getModuleSize = (node: ModuleTree | ModuleTreeLeaf, sizeKey: SizeKey) =>
    nodeSizesCache.get(node)?.[sizeKey] ?? 0;

  rawHierarchy.eachAfter((node) => {
    const nodeData = node.data;

    nodeIdsCache.set(nodeData, {
      nodeUid: generateUniqueId("node"),
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

  const size = Math.min(width, height);
  const radius = size / 2;

  const x = scaleLinear().range([0, 2 * Math.PI]);
  const y = scaleSqrt().range([0, radius]);

  const arc = d3arc<HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>>()
    .startAngle((d) => Math.max(0, Math.min(2 * Math.PI, x(d.x0))))
    .endAngle((d) => Math.max(0, Math.min(2 * Math.PI, x(d.x1))))
    .innerRadius((d) => y(d.y0))
    .outerRadius((d) => y(d.y1));

  render(
    <StaticContext.Provider
      value={{
        data,
        availableSizeProperties,
        width,
        height,
        getModuleSize,
        rawHierarchy,
        layout,
        getModuleIds,
        arc,
        radius,
        size,
      }}
    >
      <Main />
    </StaticContext.Provider>,
    parentNode
  );
};

export default drawChart;
