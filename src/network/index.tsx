import { createContext, render } from "preact";
import webcola from "webcola";

import { ModuleRenderInfo, ModuleUID, SizeKey, VisualizerData } from "../../types/types";

import { Main } from "./main";

import { Id } from "../uid";
import { getAvailableSizeOptions } from "../sizes";
import { CssColor } from "../color";

import "../style/style-treemap.scss";

export type NetworkNode = ModuleRenderInfo & { uid: string; color: CssColor; radius: number } & webcola.Node;
export type NetworkLink = webcola.Link<NetworkNode>;

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
  importedCache: ModuleLinkInfo;
  importedByCache: ModuleLinkInfo;
}

export type Context = StaticData & ChartData;

export const StaticContext = createContext<Context>(({} as unknown) as Context);

const drawChart = (parentNode: Element, data: VisualizerData, width: number, height: number): void => {
  const availableSizeProperties = getAvailableSizeOptions(data.options);

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
