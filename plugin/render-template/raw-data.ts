import { VisualizerData } from "../../shared/types.js";

export const outputRawData = (strData: string) => {
  const data = JSON.parse(strData) as VisualizerData;
  return JSON.stringify(data, null, 2);
};
