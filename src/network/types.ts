import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import type { ModuleLengths, ModuleMeta, ModuleUID } from "../../shared/types";

export type NodeInfo = { uid: ModuleUID; group: string } & ModuleMeta & ModuleLengths;
export type NetworkNode = NodeInfo & { radius: number } & SimulationNodeDatum;
export type NetworkLink = SimulationLinkDatum<NetworkNode> & {
  source: NetworkNode;
  target: NetworkNode;
};
