import { createContext, render } from "preact";
import { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

import { ModuleMeta, ModuleLengths, ModuleUID, SizeKey, VisualizerData } from "../../types/types";

import { getAvailableSizeOptions } from "../sizes";
import { CssColor } from "../color";
import { Main } from "./main";
import { NODE_MODULES } from "./util";

import "../style/style-treemap.scss";

export type NetworkNode = NodeInfo & { color: CssColor; radius: number } & SimulationNodeDatum;
export type NetworkLink = SimulationLinkDatum<NetworkNode> & { source: NetworkNode; target: NetworkNode };

export interface StaticData {
  data: VisualizerData;
  width: number;
  height: number;
}

export type NodeInfo = { uid: ModuleUID } & ModuleMeta & ModuleLengths;
export type ModuleNodeInfo = Map<ModuleUID, NodeInfo[]>;

export interface ChartData {
  nodes: Record<ModuleUID, NodeInfo>;
  nodeGroups: Record<ModuleUID, string>;
  groups: Record<string, number>;
}

export type Context = StaticData & ChartData;

export const StaticContext = createContext<Context>({} as unknown as Context);

const createNodeInfo = (data: VisualizerData, availableSizeProperties: SizeKey[], uid: ModuleUID): NodeInfo => {
  const meta = data.nodeMetas[uid];
  const entries: ModuleLengths[] = Object.values(meta.moduleParts).map((partUid) => data.nodeParts[partUid]);
  const sizes = Object.fromEntries(availableSizeProperties.map((key) => [key, 0])) as unknown as ModuleLengths;

  for (const renderInfo of entries) {
    for (const sizeKey of availableSizeProperties) {
      sizes[sizeKey] += renderInfo[sizeKey] ?? 0;
    }
  }
  return { uid, ...sizes, ...meta };
};

const drawChart = (parentNode: Element, data: VisualizerData, width: number, height: number): void => {
  const availableSizeProperties = getAvailableSizeOptions(data.options);

  const nodeGroups: Record<ModuleUID, string> = {};
  const groups: Record<string, number> = { "": 0 };
  let groupId = 1;

  const nodes: Record<ModuleUID, NodeInfo> = {};
  for (const uid of Object.keys(data.nodeMetas)) {
    nodes[uid] = createNodeInfo(data, availableSizeProperties, uid);

    const match = NODE_MODULES.exec(nodes[uid].id);
    if (match) {
      const [, nodeModuleName] = match;
      nodeGroups[uid] = nodeModuleName;
      groups[nodeModuleName] = groups[nodeModuleName] ?? groupId++;
    } else {
      nodeGroups[uid] = "";
    }
  }

  render(
    <StaticContext.Provider
      value={{
        data,
        width,
        height,
        nodes,
        nodeGroups,
        groups,
      }}
    >
      <Main />
    </StaticContext.Provider>,
    parentNode
  );
};

export default drawChart;
