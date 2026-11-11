import { createContext, render } from "preact";
import type { VisualizerData } from "../../shared/types";
import { Main } from "./main";

import "../style/style-network.scss";

export interface StaticData {
  data: VisualizerData;
  width: number;
  height: number;
}

export const StaticContext = createContext<StaticData>({} as StaticData);

const drawChart = (
  parentNode: Element,
  data: VisualizerData,
  width: number,
  height: number,
): void => {
  render(
    <StaticContext.Provider value={{ data, width, height }}>
      <Main />
    </StaticContext.Provider>,
    parentNode,
  );
};

export default drawChart;
