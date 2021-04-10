import { createContext, render } from "preact";
import webcola from "webcola";

import { ModuleRenderInfo, ModuleRenderSizes, ModuleUID, SizeKey, VisualizerData } from "../../types/types";

import { Main } from "./main";

import { getAvailableSizeOptions } from "../sizes";
import { CssColor } from "../color";

import "../style/style-treemap.scss";

export type NetworkNode = NodeInfo & { color: CssColor; radius: number } & webcola.Node;
export type NetworkLink = webcola.Link<NetworkNode>;

export interface StaticData {
  data: VisualizerData;
  availableSizeProperties: SizeKey[];
  width: number;
  height: number;
}

export type NodeInfo = { bundles: Record<string, ModuleRenderInfo>; uid: ModuleUID } & ModuleRenderInfo;
export type ModuleNodeInfo = Map<ModuleUID, NodeInfo[]>;

export interface ChartData {
  importedCache: ModuleNodeInfo;
  importedByCache: ModuleNodeInfo;
  nodes: Record<ModuleUID, NodeInfo>;
}

export type Context = StaticData & ChartData;

export const StaticContext = createContext<Context>(({} as unknown) as Context);

const createNodeInfo = (data: VisualizerData, availableSizeProperties: SizeKey[], uid: ModuleUID): NodeInfo => {
  const parts = data.nodeParts[uid];
  const entries: [string, ModuleRenderInfo][] = Object.entries(parts).map(([bundleId, partUid]) => [
    bundleId,
    data.nodes[partUid],
  ]);
  const sizes = (Object.fromEntries(availableSizeProperties.map((key) => [key, 0])) as unknown) as ModuleRenderSizes;

  for (const [, renderInfo] of entries) {
    for (const sizeKey of availableSizeProperties) {
      sizes[sizeKey] += renderInfo[sizeKey] ?? 0;
    }
  }
  const bundles = Object.fromEntries(entries);
  return { uid, bundles, ...sizes, id: entries[0][1].id };
};

const drawChart = (parentNode: Element, data: VisualizerData, width: number, height: number): void => {
  const availableSizeProperties = getAvailableSizeOptions(data.options);

  const importedByCache = new Map<ModuleUID, NodeInfo[]>();
  const importedCache = new Map<ModuleUID, NodeInfo[]>();

  const nodes: Record<ModuleUID, NodeInfo> = {};
  for (const uid of Object.keys(data.nodeParts)) {
    nodes[uid] = createNodeInfo(data, availableSizeProperties, uid);
  }

  for (const { source, target } of data.links) {
    if (!importedByCache.has(target)) {
      importedByCache.set(target, []);
    }
    if (!importedCache.has(source)) {
      importedCache.set(source, []);
    }

    importedByCache.get(target)?.push(nodes[source]);
    importedCache.get(source)?.push(nodes[target]);
  }

  render(
    <StaticContext.Provider
      value={{
        data,
        availableSizeProperties,
        width,
        height,
        importedCache,
        importedByCache,
        nodes,
      }}
    >
      <Main />
    </StaticContext.Provider>,
    parentNode
  );
};

export default drawChart;
