import { SizeKey, VisualizerData } from "../types/types";

export const LABELS: Record<SizeKey, string> = {
  renderedLength: "Rendered",
  gzipLength: "Gzip",
  brotliLength: "Brotli",
};

export const getAvailableSizeOptions = (options: VisualizerData["options"]): SizeKey[] => {
  const availableSizeProperties: SizeKey[] = ["renderedLength"];
  if (options.gzip) {
    availableSizeProperties.push("gzipLength");
  }
  if (options.brotli) {
    availableSizeProperties.push("brotliLength");
  }

  return availableSizeProperties;
};
