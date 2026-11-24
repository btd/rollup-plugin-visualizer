import { format } from "bytes";

export const formatSize = (value: number): string =>
  value > 0 && value < 1 ? "<1 B" : (format(value, { decimalPlaces: 2 }) ?? `${value} B`);
export const formatPercent = (value: number, total: number): string => {
  if (total === 0) return "";
  const percent = (value / total) * 100;
  return percent > 0 && percent < 0.01 ? "<0.01%" : `${percent.toFixed(2)}%`;
};
