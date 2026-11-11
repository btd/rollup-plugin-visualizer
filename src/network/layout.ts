import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import type { SimulationNodeDatum } from "d3-force";
import type { NetworkLink, NetworkNode, NodeInfo } from "./types";
import { createLinks } from "./data";

interface PackageCenter extends SimulationNodeDatum {
  group: string;
  radius: number;
  x: number;
  y: number;
}

// Bound the combined attraction to a shared dependency, rather than allowing
// hundreds of weak springs to pull otherwise unrelated packages together.
export const getLinkStrength = (links: NetworkLink[]) => {
  const incoming = new Map<string, number>();
  for (const { source, target } of links) {
    if (source.group !== target.group) {
      incoming.set(target.uid, (incoming.get(target.uid) ?? 0) + 1);
    }
  }
  return ({ source, target }: NetworkLink) =>
    source.group === target.group ? 0.35 : 0.06 / (incoming.get(target.uid) ?? 1);
};

export const createLayout = (info: NodeInfo[]) => {
  const largest = info.reduce((size, node) => Math.max(size, node.renderedLength), 1);
  const nodes: NetworkNode[] = info.map((node) => ({
    ...node,
    radius: 5 + 25 * Math.sqrt(node.renderedLength / largest),
  }));
  const links = createLinks(nodes);
  const members = new Map<string, NetworkNode[]>();
  for (const node of nodes) {
    const group = members.get(node.group) ?? [];
    group.push(node);
    members.set(node.group, group);
  }

  const centers = new Map<string, PackageCenter>();
  let index = 0;
  for (const [group, files] of members) {
    const angle = index++ * Math.PI * (3 - Math.sqrt(5));
    const radius = Math.sqrt(files.reduce((sum, file) => sum + (file.radius + 6) ** 2, 0)) * 1.4;
    centers.set(group, {
      group,
      radius,
      x: Math.cos(angle) * Math.sqrt(index) * 200,
      y: Math.sin(angle) * Math.sqrt(index) * 200,
    });
  }

  const packageLinks = new Map<string, { source: PackageCenter; target: PackageCenter }>();
  for (const { source, target } of links) {
    if (source.group === target.group) continue;
    const key = JSON.stringify([source.group, target.group]);
    packageLinks.set(key, {
      source: centers.get(source.group)!,
      target: centers.get(target.group)!,
    });
  }
  const packageIncoming = new Map<string, number>();
  for (const { target } of packageLinks.values()) {
    packageIncoming.set(target.group, (packageIncoming.get(target.group) ?? 0) + 1);
  }

  // Solve the much smaller package graph once. File forces keep these centers
  // as soft anchors, including for packages with no project-file ancestor.
  const packages = forceSimulation([...centers.values()])
    .stop()
    .force(
      "collision",
      forceCollide<PackageCenter>()
        .radius((node) => node.radius + 45)
        .iterations(3),
    )
    .force("charge", forceManyBody().strength(-200))
    .force(
      "link",
      forceLink<PackageCenter, { source: PackageCenter; target: PackageCenter }>([
        ...packageLinks.values(),
      ])
        .distance((link) => link.source.radius + link.target.radius + 100)
        .strength((link) => 0.08 / (packageIncoming.get(link.target.group) ?? 1)),
    )
    .force("x", forceX(0).strength(0.015))
    .force("y", forceY(0).strength(0.015));
  packages.tick(200);

  const reset = () => {
    for (const [group, files] of members) {
      const center = centers.get(group)!;
      files.forEach((node, i) => {
        const angle = i * Math.PI * (3 - Math.sqrt(5));
        const distance = center.radius * 0.7 * Math.sqrt((i + 0.5) / files.length);
        node.x = center.x + Math.cos(angle) * distance;
        node.y = center.y + Math.sin(angle) * distance;
        node.vx = node.vy = 0;
        node.fx = node.fy = null;
      });
    }
  };
  reset();
  return { nodes, links, centers, reset };
};

export const createSimulation = (
  nodes: NetworkNode[],
  links: NetworkLink[],
  centers: ReturnType<typeof createLayout>["centers"],
) =>
  forceSimulation(nodes)
    .force(
      "collision",
      forceCollide<NetworkNode>()
        .radius((node) => node.radius + 3)
        .iterations(2),
    )
    .force("charge", forceManyBody().strength(-35))
    .force(
      "link",
      forceLink<NetworkNode, NetworkLink>(links)
        .distance((link) => link.source.radius + link.target.radius + 18)
        .strength(getLinkStrength(links)),
    )
    .force("x", forceX<NetworkNode>((node) => centers.get(node.group)!.x).strength(0.08))
    .force("y", forceY<NetworkNode>((node) => centers.get(node.group)!.y).strength(0.08))
    .alphaMin(0.03);
