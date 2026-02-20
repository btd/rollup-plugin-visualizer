import { BundleId, ModuleLengths, VisualizerData } from "../../shared/types.js";

export const outputPlainTextList = (strData: string) => {
  const data = JSON.parse(strData) as VisualizerData;
  const bundles: Record<BundleId, [string, ModuleLengths][]> = {};

  for (const meta of Object.values(data.nodeMetas)) {
    for (const [bundleId, uid] of Object.entries(meta.moduleParts)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { metaUid: mainUid, ...lengths } = data.nodeParts[uid];

      bundles[bundleId] = bundles[bundleId] ?? [];
      bundles[bundleId].push([meta.id, lengths]);
    }
  }

  const bundlesEntries = Object.entries(bundles).toSorted((e1, e2) => e1[0].localeCompare(e2[0]));

  let output = "";
  const IDENT = "  ";

  for (const [bundleId, files] of bundlesEntries) {
    output += bundleId + ":\n";

    files.sort((e1, e2) => e1[0].localeCompare(e2[0]));

    for (const [file, lengths] of files) {
      output += IDENT + file + ":\n";
      output += IDENT + IDENT + `rendered: ${String(lengths.renderedLength)}\n`;
      if (data.options.gzip) {
        output += IDENT + IDENT + `gzip: ${String(lengths.gzipLength)}\n`;
      }
      if (data.options.brotli) {
        output += IDENT + IDENT + `brotli: ${String(lengths.brotliLength)}\n`;
      }
    }
  }

  return output;
};
