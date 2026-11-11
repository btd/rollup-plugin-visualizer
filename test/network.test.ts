import { describe, expect, it } from "vitest";
import { createChartData, getPackageName, matchesFilter } from "../src/network/data";
import { createLayout, createSimulation } from "../src/network/layout";
import { createFilter } from "../shared/create-filter";
import { generateNetworkData, networkFiles } from "./network-fixture";

describe("Network packages", () => {
  it.each([
    ["src/入口😀.js", ""],
    ["node_modules/react/index.js", "react"],
    ["node_modules/@scope/alpha/index.js", "@scope/alpha"],
    ["node_modules/@scope/beta/index.js", "@scope/beta"],
    ["C:\\project\\node_modules\\@scope\\alpha\\index.js", "@scope/alpha"],
    ["node_modules/.pnpm/react@19/node_modules/react/index.js", "react"],
    ["node_modules/parent/node_modules/child/index.js", "child"],
  ])("groups %s as %s", (id, pkg) => {
    expect(getPackageName(id)).toBe(pkg);
  });
});

describe.each(["rollup", "rolldown"] as const)("Network from %s", (bundler) => {
  it("keeps package files close together despite a dependency imported by every file", async () => {
    const data = await generateNetworkData(bundler, networkFiles(24));
    const { nodes } = createChartData(data);
    const layout = createLayout(nodes);
    const simulation = createSimulation(layout.nodes, layout.links, layout.centers).stop();
    simulation.tick(250);

    expect(layout.nodes).toHaveLength(74);
    expect(layout.links).toHaveLength(
      nodes.reduce((count, node) => count + node.imported.length, 0),
    );
    const packages = ["@scope/alpha", "@scope/beta", "gamma"];
    const centroids = packages.map((pkg) => {
      const files = layout.nodes.filter((node) => node.group === pkg);
      expect(files).toHaveLength(24);
      return {
        x: files.reduce((sum, node) => sum + node.x!, 0) / files.length,
        y: files.reduce((sum, node) => sum + node.y!, 0) / files.length,
        files,
      };
    });
    for (const cluster of centroids) {
      const spread = Math.max(
        ...cluster.files.map((node) => Math.hypot(node.x! - cluster.x, node.y! - cluster.y)),
      );
      for (const other of centroids) {
        if (other === cluster) continue;
        expect(Math.hypot(cluster.x - other.x, cluster.y - other.y)).toBeGreaterThan(spread * 2);
      }
    }
    const react = layout.nodes.find((node) => node.group === "react")!;
    expect(layout.links.filter((link) => link.target === react)).toHaveLength(72);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.radius).toBeGreaterThan(0);
    }
  });

  it("lays out package-only entry points and disconnected entries", async () => {
    const files = {
      "/network/node_modules/alpha/index.js": "export const a = 1;",
      "/network/node_modules/beta/index.js": "export const b = 2;",
    };
    const data = await generateNetworkData(bundler, files, Object.keys(files));
    const { nodes } = createChartData(data);
    const layout = createLayout(nodes);
    createSimulation(layout.nodes, layout.links, layout.centers).stop().tick(200);
    expect(layout.nodes).toHaveLength(2);
    expect(layout.centers.size).toBe(2);
    expect(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(
      true,
    );
  });

  it("uses real bundle names for include/exclude filters and handles modules with no rendered parts", async () => {
    const data = await generateNetworkData(bundler, {
      "/network/src/入口😀.js": "import { unused } from './unused.js'; export const x=1;",
      "/network/src/unused.js": "export const unused=2;",
    });
    const { nodes } = createChartData(data);
    const entry = nodes.find((node) => node.isEntry)!;
    const unused = nodes.find((node) => node.id.endsWith("unused.js"))!;
    const bundle = Object.keys(entry.moduleParts)[0];
    const include = createFilter({ bundle }, undefined);
    const exclude = createFilter(undefined, { bundle });
    expect(matchesFilter(entry, (bundleId, node) => +include(bundleId, node.id))).toBe(true);
    expect(matchesFilter(entry, (bundleId, node) => +exclude(bundleId, node.id))).toBe(false);
    expect(matchesFilter(unused, (bundleId, node) => +include(bundleId, node.id))).toBe(false);
    expect(matchesFilter(unused, () => 1)).toBe(true);
    const layout = createLayout(nodes);
    expect(layout.nodes.find((node) => node.uid === unused.uid)!.radius).toBeGreaterThan(0);

    // Reusing node objects lets a filtered graph retain manual placements.
    const moved = layout.nodes.find((node) => node.uid === entry.uid)!;
    moved.x = moved.fx = 700;
    moved.y = moved.fy = -300;
    createSimulation([moved], [], layout.centers).stop().tick(50);
    expect([moved.x, moved.y]).toEqual([700, -300]);
    layout.reset();
    expect(moved.fx).toBeNull();
    expect(moved.fy).toBeNull();
    expect([moved.x, moved.y]).not.toEqual([700, -300]);
  });
});
