import { describe, expect, it } from "vitest";
import { Reader, Writer } from "../dist/shared/share/binary.js";
import { resolveLimits } from "../dist/shared/share/limits.js";

describe("Share binary primitives", () => {
  it("uses minimal unsigned integers without narrowing above 32 bits", () => {
    const writer = new Writer(resolveLimits());
    for (const n of [0, 127, 128, 4_294_967_296, Number.MAX_SAFE_INTEGER]) writer.uint(n);
    const bytes = writer.finish();
    expect([...bytes.slice(0, 4)]).toEqual([0, 127, 128, 1]);
    const reader = new Reader(bytes, resolveLimits());
    expect(Array.from({ length: 5 }, () => reader.uint())).toEqual([
      0,
      127,
      128,
      4_294_967_296,
      Number.MAX_SAFE_INTEGER,
    ]);
    reader.end();
  });
  it("preserves Unicode text, BOM characters and nonmonotonic vectors", () => {
    const writer = new Writer(resolveLimits());
    writer.text("\uFEFF🐢é é");
    writer.vector([8, 1, 9, 0], true);
    const reader = new Reader(writer.finish(), resolveLimits());
    expect(reader.text()).toBe("\uFEFF🐢é é");
    expect(reader.vector()).toEqual([8, 1, 9, 0]);
    reader.end();
  });
  it("falls back to absolute values when a signed difference exceeds the safe range", () => {
    const writer = new Writer(resolveLimits());
    writer.vector([0, Number.MAX_SAFE_INTEGER, 0], true);
    expect(new Reader(writer.finish(), resolveLimits()).vector()).toEqual([
      0,
      Number.MAX_SAFE_INTEGER,
      0,
    ]);
  });
  it.each([[128, 0], [255, 255, 255, 255, 255, 255, 255, 127], [128]])(
    "rejects invalid integers",
    (bytes) => {
      expect(() => new Reader(Uint8Array.from(bytes), resolveLimits()).uint()).toThrow();
    },
  );
  it("rejects malformed UTF-8, declared counts and output budgets", () => {
    expect(() => new Reader(Uint8Array.of(1, 255), resolveLimits()).text()).toThrow();
    expect(() => new Reader(Uint8Array.of(127), resolveLimits()).vector()).toThrow();
    expect(() => new Writer(resolveLimits({ maxBinaryBytes: 0 })).uint(0)).toThrow(/limit/);
  });
});
