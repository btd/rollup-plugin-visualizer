export class Transform {
  constructor(readonly k: number, readonly x: number, readonly y: number) {}

  scaled(k: number) {
    return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
  }

  translated(x: number, y: number) {
    return x === 0 && y === 0
      ? this
      : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
  }

  invertPoint(location: [number, number]): [number, number] {
    return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
  }

  toString() {
    return "translate(" + String(this.x) + "," + String(this.y) + ") scale(" + String(this.k) + ")";
  }
}

export const identityTransform = new Transform(1, 0, 0);
