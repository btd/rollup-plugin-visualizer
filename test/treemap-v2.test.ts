import { describe, expect, it } from "vitest";
import { SourceMapGenerator } from "source-map";
import { mergeReports } from "../dist/plugin/cli/report.js";
import { InspectorData, moduleTarget, outputTarget } from "../src/treemap-v2/data";
import { FILTER_ROOT, generateFilteredReport } from "./filtering-fixture";

const entry = FILTER_ROOT + "src/入口😀.js";
const files = {
  [entry]: `import { value } from '../node_modules/pkg/index.js';
    import { other } from '../node_modules/pkg/other.js';
    console.log(value, other); import('../node_modules/pkg/impl.js').then(console.log);`,
  [FILTER_ROOT + "node_modules/pkg/index.js"]: `export { value } from './impl.js';`,
  [FILTER_ROOT + "node_modules/pkg/impl.js"]: `export const value = Math.random();`,
  [FILTER_ROOT + "node_modules/pkg/other.js"]: `export const other = Math.random();`,
};
describe.each(["rollup", "rolldown", "vite"] as const)("Treemap v2 from %s", (bundler) => {
  it("aggregates exactly the output group's sizes and boundary endpoints", async () => {
    const { data } = await generateFilteredReport(bundler, {
      files,
      input: { entry },
      sourcemap: true,
    });
    const model = new InspectorData(data);
    const group = [...model.nodes.values()].find(
      (node) => node.children.length && node.name.endsWith("pkg"),
    )!;
    expect(group).toBeDefined();
    const target = outputTarget(group.key);
    const members = model.members(target);
    expect(members.map((node) => data.nodeMetas[node.metaUid!].id).sort()).toEqual([
      "node_modules/pkg/impl.js",
      "node_modules/pkg/other.js",
    ]);
    expect(model.size(target, "renderedLength")).toBe(
      members.reduce((sum, node) => sum + data.nodeParts[node.partUid!].renderedLength, 0),
    );
    const incoming = model.relationships(target).incoming;
    expect(
      incoming.map((edge) => [
        data.nodeMetas[edge.source].id,
        data.nodeMetas[edge.target].id,
        edge.dynamic,
      ]),
    ).toEqual([
      ["node_modules/pkg/index.js", "node_modules/pkg/impl.js", false],
      ["src/入口😀.js", "node_modules/pkg/impl.js", true],
      ["src/入口😀.js", "node_modules/pkg/other.js", false],
    ]);
    expect(model.relationships(target).internal).toEqual([]);
    const index = Object.entries(data.nodeMetas).find(([, meta]) =>
      meta.id.endsWith("pkg/index.js"),
    )!;
    expect(model.parts(moduleTarget(index[0]))).toEqual([]);
    expect(model.size(moduleTarget(index[0]), "renderedLength")).toBeUndefined();
    expect(
      model
        .relationships(moduleTarget(index[0]))
        .incoming.map((edge) => data.nodeMetas[edge.source].id),
    ).toEqual(["src/入口😀.js"]);
    expect(
      model
        .relationships(moduleTarget(index[0]))
        .outgoing.map((edge) => data.nodeMetas[edge.target].id),
    ).toEqual(["node_modules/pkg/impl.js"]);
  });

  it("keeps chunk measurements separate for one sourcemap source in two output chunks", async () => {
    const shared = FILTER_ROOT + "src/shared😀.js";
    const left = FILTER_ROOT + "src/left.js",
      right = FILTER_ROOT + "src/right.js";
    // Vite does not preserve unused entry exports; observable calls retain both
    // contributions through its production tree-shaking pipeline.
    const sources = {
      [left]: "console.log('left😀', Math.random());",
      [right]: "console.log('right😀', Math.random() + 123456);",
    };
    const maps = Object.fromEntries(
      Object.keys(sources).map((id) => {
        const map = new SourceMapGenerator({ file: id });
        map.addMapping({
          generated: { line: 1, column: 0 },
          original: { line: 1, column: 0 },
          source: shared,
        });
        map.setSourceContent(shared, "export const shared = Math.random();");
        return [id, map.toJSON()];
      }),
    );
    const { data } = await generateFilteredReport(bundler, {
      input: { left, right },
      files: sources,
      maps,
      sourcemap: true,
    });
    const model = new InspectorData(data);
    const uid = Object.keys(data.nodeMetas).find(
      (uid) => data.nodeMetas[uid].id === "src/shared😀.js",
    )!;
    expect(
      model
        .parts(moduleTarget(uid))
        .map((part) => part.chunk)
        .sort(),
    ).toEqual(["left.js", "right.js"]);
    expect(model.size(moduleTarget(uid), "renderedLength")).toBeUndefined();
    for (const part of model.parts(moduleTarget(uid))) {
      const target = outputTarget(model.partNodes.get(part.uid)!.key);
      expect(model.size(target, "renderedLength")).toBe(data.nodeParts[part.uid].renderedLength);
      expect(model.scope(target)).toEqual({
        label: part.chunk,
        size: model.chunkSizes.get(part.node.chunkKey!),
      });
    }
  });
});

describe("Canonical relationship queries", () => {
  it("uses each actual chunk occurrence as its denominator when CLI reports share a chunk name", async () => {
    const first = await generateFilteredReport("rollup", {
      files,
      input: { entry },
      sourcemap: true,
    });
    const second = await generateFilteredReport("rollup", {
      files: { ...files, [entry]: files[entry] + "\nconsole.log('different build');" },
      input: { entry },
      sourcemap: true,
    });
    const model = new InspectorData(
      mergeReports([
        { file: "first.json", data: first.data },
        { file: "second.json", data: second.data },
      ]),
    );
    expect(model.root.children).toHaveLength(2);
    for (const chunk of model.root.children)
      expect(model.scope(outputTarget(chunk.key)).size).toEqual(chunk.sizes);
  });
  it("traverses a wide supported hierarchy without spreading siblings into function arguments", () => {
    const data = {
      version: 2,
      tree: {
        name: "root",
        children: Array.from({ length: 150_000 }, (_, i) => ({ name: String(i), children: [] })),
      },
      nodeMetas: {},
      nodeParts: {},
      env: {},
      options: { gzip: false, brotli: false, sourcemap: false },
    };
    const model = new InspectorData(data);
    expect(model.members(outputTarget(model.root.key))).toEqual([]);
  });
  it("deduplicates exact edges, retains import kind and self-imports, and keeps metadata identities distinct", async () => {
    const { data } = await generateFilteredReport("rollup", {
      files,
      input: { entry },
      sourcemap: true,
    });
    const [uid, meta] = Object.entries(data.nodeMetas).find(([, meta]) =>
      meta.id.endsWith("pkg/impl.js"),
    )!;
    meta.imported.push({ uid }, { uid }, { uid, dynamic: true });
    const model = new InspectorData(data);
    const own = model
      .relationships(moduleTarget(uid))
      .outgoing.filter((edge) => edge.target === uid);
    expect(own.map((edge) => edge.dynamic)).toEqual([false, true]);
    expect(
      model.relationships(moduleTarget(uid)).incoming.filter((edge) => edge.source === uid),
    ).toEqual(own);
    const root = model.relationships(outputTarget(model.root.key));
    expect(root.internal.filter((edge) => edge.source === uid && edge.target === uid)).toHaveLength(
      2,
    );
    expect(
      model.members(outputTarget(model.root.key)).every((node) => node.partUid !== undefined),
    ).toBe(true);
  });
});
