import type { VisualizerData } from "../../shared/types";
import type { NetworkLink, NetworkNode, NodeInfo } from "./types";

export const getPackageName = (id: string): string => {
  const matches = id.replaceAll("\\", "/").matchAll(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/g);
  let name = "";
  for (const match of matches) name = match[1];
  return name;
};

export const createChartData = (data: VisualizerData) => {
  const groups: Record<string, number> = Object.create(null);
  const nodes: NodeInfo[] = Object.entries(data.nodeMetas).map(([uid, meta]) => {
    const group = getPackageName(meta.id);
    groups[group] ??= Object.keys(groups).length;
    const sizes = { renderedLength: 0, gzipLength: 0, brotliLength: 0 };
    for (const partUid of Object.values(meta.moduleParts)) {
      const part = data.nodeParts[partUid];
      sizes.renderedLength += part.renderedLength;
      sizes.gzipLength += part.gzipLength ?? 0;
      sizes.brotliLength += part.brotliLength ?? 0;
    }
    return { ...meta, ...sizes, uid, group };
  });
  return { nodes, groups };
};

export const matchesFilter = (
  node: NodeInfo,
  filter: (bundleId: string, node: NodeInfo) => number,
): boolean => {
  const bundles = Object.keys(node.moduleParts);
  return (bundles.length ? bundles : [""]).some((bundle) => filter(bundle, node) !== 0);
};

export const createLinks = (nodes: NetworkNode[]): NetworkLink[] => {
  const byUid = new Map(nodes.map((node) => [node.uid, node]));
  return nodes.flatMap((source) =>
    source.imported.flatMap(({ uid }) => {
      const target = byUid.get(uid);
      return target ? [{ source, target }] : [];
    }),
  );
};
