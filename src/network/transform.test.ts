import { describe, expect, it } from "vitest";
import { fitTransform, identityTransform, MAX_ZOOM, MIN_ZOOM, Transform } from "./transform";

describe("Network camera", () => {
  it("keeps the graph point under the cursor when zooming, including at limits", () => {
    const camera = new Transform(2, 150, -70);
    const cursor: [number, number] = [-120, 220];
    const point = camera.invertPoint(cursor);
    for (const factor of [0.00001, 0.5, 1.5, 10000]) {
      const zoomed = camera.zoomAt(cursor, factor);
      const after = zoomed.invertPoint(cursor);
      expect(after[0]).toBeCloseTo(point[0]);
      expect(after[1]).toBeCloseTo(point[1]);
      expect(zoomed.k).toBeGreaterThanOrEqual(MIN_ZOOM);
      expect(zoomed.k).toBeLessThanOrEqual(MAX_ZOOM);
    }
  });

  it.each([
    [1200, 800],
    [800, 600],
    [600, 400],
  ])("fits complete circles in a %s × %s viewBox", (width, height) => {
    const nodes = [
      { x: -2000, y: -300, radius: 30 },
      { x: 1000, y: 700, radius: 20 },
    ];
    const camera = fitTransform(nodes, width, height);
    for (const node of nodes) {
      expect(Math.abs(node.x * camera.k + camera.x) + node.radius * camera.k).toBeLessThan(
        width / 2,
      );
      expect(Math.abs(node.y * camera.k + camera.y) + node.radius * camera.k).toBeLessThan(
        height / 2,
      );
    }
  });

  it("can reset and fit an empty graph", () => {
    expect(fitTransform([], 800, 600)).toBe(identityTransform);
    expect(identityTransform.invertPoint([10, -20])).toEqual([10, -20]);
  });
});
