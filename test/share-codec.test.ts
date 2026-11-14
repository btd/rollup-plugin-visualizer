import assert from "node:assert/strict";
import frozenV1 from "./fixtures/share/v1.json";
import { gzipSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodeReport, encodeReport } from "../dist/shared/share/codec.js";
import {
  decodeFragment,
  encodeFragment,
  fragmentFromGzip,
} from "../dist/shared/share/transport.js";
import { validateReport } from "../dist/shared/share/validation.js";
import { deriveTree } from "../dist/shared/share/reconstruct.js";
import { resolveLimits } from "../dist/shared/share/limits.js";
import { generateFilteredReport } from "./filtering-fixture.js";
import { emptyShareFixture, shareFixture } from "./share-fixture.js";

// Independent, fixed v1 bytes: title T, no options, env {}, string root,
// empty UID/module/part/edge tables, reconstructed incoming/tree, no extensions.
const golden = Uint8Array.from([
  1, 84, 0, 2, 123, 125, 1, 1, 0, 0, 4, 114, 111, 111, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0,
]);

describe("Shared report wire format", () => {
  it("keeps the original v1 fixture readable and its encoding unchanged", () => {
    const report = { title: "T", data: emptyShareFixture(), extensions: [] };
    expect(decodeReport(golden)).toStrictEqual(report);
    expect(encodeReport(report)).toEqual(golden);
  });

  it("opens the frozen nonempty v1 link without regenerating its bytes", async () => {
    const result = await decodeFragment(frozenV1.fragment);
    expect(result).toStrictEqual({ title: frozenV1.title, data: frozenV1.data, extensions: [] });
  });

  it("preserves Unicode, optional false flags, cycles, zero and safe-integer sizes", () => {
    const data = shareFixture();
    const copy = structuredClone(data);
    const result = decodeReport(encodeReport({ title: "stats <🐢>", data }));
    expect(result.data).toStrictEqual(data);
    expect(result.title).toBe("stats <🐢>");
    expect(Object.keys(result.data.nodeMetas)).toEqual(Object.keys(data.nodeMetas));
    expect(Object.keys(result.data.nodeParts)).toEqual(Object.keys(data.nodeParts));
    expect(Object.keys(result.data.nodeMetas["α-00"].moduleParts)).toEqual([
      "β.bundle.js",
      "zero.js",
    ]);
    expect(result.data.nodeMetas["other-prefix-2"]).not.toHaveProperty("isEntry");
    expect(data).toStrictEqual(copy);
  });

  it.each(["rollup", "rolldown", "vite"] as const)(
    "preserves real %s reports without altering contents or order",
    async (bundler) => {
      const { data } = await generateFilteredReport(bundler, {
        visualizer: { gzipSize: true, brotliSize: true },
      });
      const result = decodeReport(encodeReport({ data }));
      expect(result.data).toStrictEqual(data);
      expect(Object.keys(result.data.nodeMetas)).toEqual(Object.keys(data.nodeMetas));
      expect(Object.keys(result.data.nodeParts)).toEqual(Object.keys(data.nodeParts));
    },
  );

  it("accepts and retains optional extensions without changing the core report", () => {
    const bytes = Uint8Array.from([...golden.slice(0, -1), 1, 7, 3, 1, 2, 3]);
    const result = decodeReport(bytes);
    expect(result.data).toStrictEqual(emptyShareFixture());
    expect(result.extensions).toStrictEqual([{ id: 7, payload: Uint8Array.of(1, 2, 3) }]);
    expect(encodeReport(result)).toEqual(bytes);
  });

  it.each([
    golden.slice(0, -1),
    Uint8Array.from([...golden, 0]),
    Uint8Array.from([128, 0, ...golden.slice(1)]),
    Uint8Array.from([...golden.slice(0, 2), 8, ...golden.slice(3)]),
    Uint8Array.from([...golden.slice(0, -1), 2, 7, 0, 7, 0]),
  ])("rejects malformed, nonminimal, reserved, or duplicate data", (bytes) => {
    expect(() => decodeReport(bytes)).toThrow();
  });

  it("rejects invalid references, unknown fields, malformed text and numeric overflow", () => {
    const data = shareFixture();
    data.nodeParts["part-00"].metaUid = "missing";
    expect(() => encodeReport({ data })).toThrow(/reference|owner/i);
    const unknown = { ...emptyShareFixture(), futureField: true };
    expect(() => encodeReport({ data: unknown })).toThrow(/field|shape/i);
    expect(() => encodeReport({ title: "\ud800", data: emptyShareFixture() })).toThrow(
      /UTF|Unicode/i,
    );
    const oversized = shareFixture();
    oversized.nodeParts["part-00"].renderedLength = Number.MAX_SAFE_INTEGER + 1;
    expect(() => encodeReport({ data: oversized })).toThrow(/integer|size/i);
  });

  it("checks declared counts and text budgets before allocating report structures", () => {
    expect(() => decodeReport(golden, { maxRecords: 0 })).toThrow(/limit|budget/i);
    expect(() => decodeReport(golden, { maxTextBytes: 1 })).toThrow(/limit|budget/i);
    expect(() => decodeReport(golden, { maxBinaryBytes: 1 })).toThrow(/limit|budget/i);
  });

  it("applies the same reconstructed-text budget while encoding and decoding", () => {
    const data = shareFixture();
    const encoded = encodeReport({ data });
    let minimumDecode = 0;
    for (; minimumDecode < 10_000; minimumDecode++) {
      try {
        decodeReport(encoded, { maxTextBytes: minimumDecode });
        break;
      } catch (error) {
        expect(String(error)).toMatch(/limit/);
      }
    }
    expect(minimumDecode).toBeLessThan(10_000);
    expect(() => encodeReport({ data }, { maxTextBytes: minimumDecode - 1 })).toThrow(/limit/);
    expect(() =>
      decodeReport(encodeReport({ data }, { maxTextBytes: minimumDecode }), {
        maxTextBytes: minimumDecode,
      }),
    ).not.toThrow();
  });

  it("preserves special dictionary keys without changing object prototypes", () => {
    const data = emptyShareFixture();
    data.nodeMetas = JSON.parse(
      '{"__proto__":{"id":"/a.js","moduleParts":{"__proto__":"constructor"},"imported":[],"importedBy":[]}}',
    );
    data.nodeParts = {
      constructor: { metaUid: "__proto__", renderedLength: 0, gzipLength: 0, brotliLength: 0 },
    };
    data.tree.children.push({ name: "a", uid: "constructor" });
    const result = decodeReport(encodeReport({ data })).data;
    // Native comparison handles a data property named constructor without treating it as a class.
    assert.deepStrictEqual(result, data);
    expect(Object.getPrototypeOf(result.nodeMetas)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(result.nodeMetas.__proto__.moduleParts)).toBe(Object.prototype);
  });

  it("bounds text repeated through shared module references before rendering", () => {
    const data = emptyShareFixture();
    for (let i = 0; i < 10; i++)
      data.nodeMetas[`m${i}`] = {
        id: "x".repeat(128),
        moduleParts: {},
        imported: [],
        importedBy: [],
      };
    expect(() => validateReport(data, resolveLimits({ maxTextBytes: 256 }))).toThrow(
      /text.*limit/i,
    );
  });

  it("bounds repeated path expansion during hierarchy reconstruction", () => {
    const data = emptyShareFixture();
    const id = "x".repeat(128);
    data.nodeMetas.m = { id, moduleParts: {}, imported: [], importedBy: [] };
    for (let i = 0; i < 10; i++) {
      const uid = `p${i}`;
      data.nodeParts[uid] = { metaUid: "m", renderedLength: 0, gzipLength: 0, brotliLength: 0 };
      data.nodeMetas.m.moduleParts[`bundle${i}`] = uid;
    }
    expect(() =>
      deriveTree(
        data,
        {
          rootName: "root",
          rootState: 0,
          names: Object.keys(data.nodeMetas.m.moduleParts),
          kinds: Array(10).fill(0),
          parts: [],
        },
        resolveLimits({ maxTextBytes: 256 }),
      ),
    ).toThrow(/text.*limit/i);
  });

  it("bounds environment nesting before parsing and rejects raw-data cycles", () => {
    const data = emptyShareFixture();
    data.env = { nested: { deeper: { value: 1 } } };
    const bytes = encodeReport({ data });
    expect(() => decodeReport(bytes, { maxJsonDepth: 1 })).toThrow(/depth|limit/);
    const cyclic = emptyShareFixture();
    cyclic.env.self = cyclic.env;
    expect(() => encodeReport({ data: cyclic })).toThrow(/cycle/);
  });
});

describe("Native gzip report fragments", () => {
  it("interoperates with Node gzip and preserves links beyond GitHub's renderer limit", async () => {
    const report = { title: "test", data: shareFixture() };
    const bytes = encodeReport(report);
    const fragment = await encodeFragment(report);
    expect(fragment).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(gunzipSync(Buffer.from(fragment.slice(2), "base64url"))).toEqual(Buffer.from(bytes));
    expect((await decodeFragment(fragmentFromGzip(gzipSync(bytes)))).data).toStrictEqual(
      report.data,
    );
    expect((await decodeFragment(fragment)).title).toBe("test");
    const long = Array.from(
      { length: 12_000 },
      (_, i) => `${i.toString(36)}-${Math.imul(i, 2654435761) >>> 0}`,
    ).join("/");
    const large = await encodeFragment({ title: long, data: emptyShareFixture() });
    expect(large.length).toBeGreaterThan(32_768);
    expect((await decodeFragment(large)).title).toBe(long);
  });

  it.each(["", "1", "1.", "1.!!!", "1.Zg=", "1.Zh"])(
    "rejects invalid fragment %s",
    async (fragment) => {
      await expect(decodeFragment(fragment)).rejects.toThrow();
    },
  );

  it("distinguishes unknown versions and bounds native decompression", async () => {
    await expect(decodeFragment("2.AA")).rejects.toMatchObject({ code: "unsupported-version" });
    const fragment = await encodeFragment({
      title: "x".repeat(100_000),
      data: emptyShareFixture(),
    });
    await expect(decodeFragment(fragment, { maxBinaryBytes: 64 })).rejects.toMatchObject({
      code: "resource-limit",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      encodeFragment({ data: emptyShareFixture() }, {}, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
