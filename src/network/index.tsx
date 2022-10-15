import { createContext, render } from "preact";
import { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";

import { ModuleMeta, ModuleLengths, ModuleUID, SizeKey, VisualizerData } from "../../types/types";

import { getAvailableSizeOptions } from "../sizes";
import { Main } from "./main";
import { NODE_MODULES } from "./util";

import "../style/style-treemap.scss";

export type NetworkNode = NodeInfo & { radius: number } & SimulationNodeDatum;
export type NetworkLink = SimulationLinkDatum<NetworkNode> & {
  source: NetworkNode;
  target: NetworkNode;
};

export interface StaticData {
  data: VisualizerData;
  width: number;
  height: number;
}

export type NodeInfo = { uid: ModuleUID; group: string } & ModuleMeta & ModuleLengths;
export type ModuleNodeInfo = Map<ModuleUID, NodeInfo[]>;

export interface ChartData {
  nodes: NodeInfo[];
  nodeGroups: Record<ModuleUID, string>;
  groups: Record<string, number>;
  groupLayers: string[][];
}

export type Context = StaticData & ChartData;

export const StaticContext = createContext<Context>({} as unknown as Context);

const createNodeInfo = (
  data: VisualizerData,
  availableSizeProperties: SizeKey[],
  uid: ModuleUID
): NodeInfo => {
  const meta = data.nodeMetas[uid];
  const entries: ModuleLengths[] = Object.values(meta.moduleParts).map(
    (partUid) => data.nodeParts[partUid]
  );
  const sizes = Object.fromEntries(
    availableSizeProperties.map((key) => [key, 0])
  ) as unknown as ModuleLengths;

  for (const renderInfo of entries) {
    for (const sizeKey of availableSizeProperties) {
      sizes[sizeKey] += renderInfo[sizeKey] ?? 0;
    }
  }

  const match = NODE_MODULES.exec(meta.id);

  return { uid, ...sizes, ...meta, group: match?.[1] ?? "" };
};

const drawChart = (
  parentNode: Element,
  data: VisualizerData,
  width: number,
  height: number
): void => {
  const availableSizeProperties = getAvailableSizeOptions(data.options);

  const nodeGroups: Record<ModuleUID, string> = {};
  const groups: Record<string, number> = { "": 0 };
  let groupId = 1;

  const nodes: NodeInfo[] = [];
  for (const uid of Object.keys(data.nodeMetas)) {
    const node = createNodeInfo(data, availableSizeProperties, uid);
    nodes.push(node);

    nodeGroups[uid] = node.group;
    groups[node.group] = groups[node.group] ?? groupId++;
  }

  const groupLinks: Record<string, Set<string>> = { "": new Set<string>() };

  for (const [sourceUid, { imported }] of Object.entries(data.nodeMetas)) {
    for (const { uid: targetUid } of imported) {
      const sourceGroup = nodeGroups[sourceUid];
      const targetGroup = nodeGroups[targetUid];

      if (!(sourceGroup in groupLinks)) {
        groupLinks[sourceGroup] = new Set<string>();
      }
      groupLinks[sourceGroup].add(targetGroup);
    }
  }

  const groupLayers: string[][] = [[""]];
  const seen = new Set([""]);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const lastLayer = groupLayers[groupLayers.length - 1];
    const newLayer = new Set<string>();

    for (const currentGroup of lastLayer) {
      for (const targetGroup of groupLinks[currentGroup] ?? []) {
        if (seen.has(targetGroup)) {
          continue;
        }

        seen.add(targetGroup);

        newLayer.add(targetGroup);
      }
    }
    if (newLayer.size === 0) {
      break;
    }
    groupLayers.push([...newLayer]);
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
        groupLayers,
      }}
    >
      <Main />
    </StaticContext.Provider>,
    parentNode
  );
};

export default drawChart;
