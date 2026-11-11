export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 20;

export class Transform {
  constructor(
    readonly k: number,
    readonly x: number,
    readonly y: number,
  ) {}

  zoomAt(point: [number, number], factor: number) {
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.k * factor));
    const [x, y] = this.invertPoint(point);
    return new Transform(k, point[0] - x * k, point[1] - y * k);
  }

  invertPoint(location: [number, number]): [number, number] {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  }

  toString() {
    return "translate(" + String(this.x) + "," + String(this.y) + ") scale(" + String(this.k) + ")";
  }
}

export const identityTransform = new Transform(1, 0, 0);

export const fitTransform = (
  nodes: { x?: number; y?: number; radius: number }[],
  width: number,
  height: number,
): Transform => {
  if (!nodes.length) return identityTransform;
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    left = Math.min(left, node.x - node.radius);
    right = Math.max(right, node.x + node.radius);
    top = Math.min(top, node.y - node.radius);
    bottom = Math.max(bottom, node.y + node.radius);
  }
  if (!Number.isFinite(left)) return identityTransform;
  const k = Math.max(
    MIN_ZOOM,
    Math.min(
      1.5,
      Math.max(1, width - 100) / Math.max(1, right - left),
      Math.max(1, height - 140) / Math.max(1, bottom - top),
    ),
  );
  return new Transform(k, (-(left + right) * k) / 2, (-(top + bottom) * k) / 2);
};
