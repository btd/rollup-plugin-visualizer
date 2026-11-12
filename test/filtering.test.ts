import { describe, expect, it } from "vitest";
import { SourceMapGenerator } from "source-map";
import { createChartData } from "../src/network/data";
import { createLayout } from "../src/network/layout";
import { createFilter } from "../shared/create-filter";
import {
  isModuleTree,
  type ModuleTree,
  type ModuleTreeLeaf,
  type VisualizerData,
} from "../shared/types";
import {
  FILTER_ENTRY,
  FILTER_HTML,
  FILTER_ROOT,
  filteringFiles,
  generateFilteredReport,
  packageExclusions,
} from "./filtering-fixture";

const metasById = (data: VisualizerData) =>
  Object.fromEntries(
    Object.entries(data.nodeMetas).map(([uid, meta]) => [meta.id, { ...meta, uid }]),
  );
const sortedIds = (data: VisualizerData) =>
  Object.values(data.nodeMetas)
    .map((n) => n.id)
    .sort();
const bootstrap = (html: string) => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)![1];

// Assert the data contract used by charts, tooltip importer lookups, and exports.
const assertReferences = (data: VisualizerData) => {
  const leaves: string[] = [];
  const visit = (tree: ModuleTree | ModuleTreeLeaf) => {
    if (isModuleTree(tree)) {
      if (tree !== data.tree) expect(tree.children.length).toBeGreaterThan(0);
      tree.children.forEach(visit);
    } else {
      expect(data.nodeParts[tree.uid]).toBeDefined();
      leaves.push(tree.uid);
    }
  };
  visit(data.tree);
  expect(leaves.sort()).toEqual(Object.keys(data.nodeParts).sort());
  for (const [uid, meta] of Object.entries(data.nodeMetas)) {
    for (const partUid of Object.values(meta.moduleParts)) {
      expect(data.nodeParts[partUid]?.metaUid).toBe(uid);
    }
    for (const imported of meta.imported) {
      const target = data.nodeMetas[imported.uid];
      expect(target).toBeDefined();
      expect(target.importedBy.some((link) => link.uid === uid)).toBe(true);
    }
    for (const importedBy of meta.importedBy) {
      const source = data.nodeMetas[importedBy.uid];
      expect(source).toBeDefined();
      expect(source.imported.some((link) => link.uid === uid)).toBe(true);
    }
  }
  for (const [uid, part] of Object.entries(data.nodeParts)) {
    expect(Object.values(data.nodeMetas[part.metaUid].moduleParts)).toContain(uid);
  }
};

const assertEmpty = (data: VisualizerData) => {
  expect(data.tree.children).toEqual([]);
  expect(data.nodeMetas).toEqual({});
  expect(data.nodeParts).toEqual({});
  expect(createChartData(data).nodes).toEqual([]);
  assertReferences(data);
};

describe.each(["rollup", "rolldown"] as const)("Report filters from %s", (bundler) => {
  describe.each([false, true])("sourcemap attribution: %s", (sourcemap) => {
    it("removes excluded packages from nodes, links, tree, tooltips, and every report", async () => {
      const baseline = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: { gzipSize: true, brotliSize: true },
      });
      const { data, reports } = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: { exclude: packageExclusions, gzipSize: true, brotliSize: true },
        templates: [...FILTER_HTML, "list", "markdown"],
      });
      const allowed = createFilter(undefined, packageExclusions);
      expect(sortedIds(data)).toEqual(sortedIds(baseline.data).filter((id) => allowed("", id)));
      const metas = metasById(data);
      // Traversal must continue through date-fns to discover this allowed utility.
      expect(metas["node_modules/kept-util/index.js"]).toBeDefined();
      expect(metas["src/入口😀.js"].imported.some((link) => link.dynamic)).toBe(true);
      assertReferences(data);
      const before = metasById(baseline.data);
      for (const [id, meta] of Object.entries(metas)) {
        for (const [bundle, uid] of Object.entries(meta.moduleParts)) {
          const oldPart = baseline.data.nodeParts[before[id].moduleParts[bundle]];
          const { metaUid: _, ...sizes } = data.nodeParts[uid];
          expect(sizes).toEqual({
            renderedLength: oldPart.renderedLength,
            gzipLength: oldPart.gzipLength,
            brotliLength: oldPart.brotliLength,
          });
        }
      }
      const nodes = createChartData(data).nodes;
      if (!sourcemap) {
        expect(
          Object.values(data.nodeParts).some(
            (part) => part.gzipLength > 0 && part.brotliLength > 0,
          ),
        ).toBe(true);
      }
      expect(nodes.map((n) => n.id).sort()).toEqual(sortedIds(data));
      const layout = createLayout(nodes);
      expect(layout.nodes.every((node) => Number.isFinite(node.radius) && node.radius > 0)).toBe(
        true,
      );
      expect(layout.links.length).toBe(nodes.reduce((sum, n) => sum + n.imported.length, 0));
      for (const template of FILTER_HTML) {
        const embedded = bootstrap(reports[template]).match(/const data = (.*);/);
        expect(JSON.parse(embedded![1])).toEqual(data);
      }
      for (const template of ["list", "markdown"]) {
        expect(reports[template]).not.toContain("node_modules/date-fns/index.js");
        expect(reports[template]).not.toContain("node_modules/lodash-es/index.js");
        expect(reports[template]).not.toContain("node_modules/lucide-react/index.js");
      }
      // Markdown's import summary is calculated from retained links only.
      const allMetas = Object.values(data.nodeMetas);
      const imports = allMetas.flatMap((meta) => meta.imported);
      const summary = [
        new Set(allMetas.flatMap((meta) => Object.keys(meta.moduleParts))).size,
        allMetas.filter((meta) => Object.keys(meta.moduleParts).length).length,
        allMetas.filter((meta) => meta.isEntry).length,
        allMetas.filter((meta) => meta.isExternal).length,
        imports.filter((link) => !link.dynamic).length,
        imports.filter((link) => link.dynamic).length,
      ];
      expect(reports.markdown).toContain(`| ${summary.join(" | ")} |`);
    });

    it("matches original IDs, applies exclude precedence, and removes dynamic edges", async () => {
      const { data } = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: {
          projectRoot: /^\/filtering\//,
          include: { file: "/filtering/src/**" },
          exclude: { file: "/filtering/src/lazy.js" },
        },
      });
      expect(sortedIds(data)).toEqual(
        ["src/empty.js", "src/keep.js", "src/unused.js", "src/入口😀.js"].sort(),
      );
      expect(
        Object.values(data.nodeMetas)
          .flatMap((n) => n.imported)
          .some((n) => n.dynamic),
      ).toBe(false);
      assertReferences(data);
    });

    it("keeps allowed descendants when the entry and intermediary are excluded, without bridging edges", async () => {
      const { data } = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: { exclude: [...packageExclusions, { file: FILTER_ENTRY }] },
      });
      const metas = metasById(data);
      expect(metas["src/入口😀.js"]).toBeUndefined();
      expect(metas["src/keep.js"].importedBy).toEqual([]);
      expect(metas["src/lazy.js"].importedBy).toEqual([]);
      expect(
        metas["node_modules/kept-util/index.js"].importedBy.map(
          (link) => data.nodeMetas[link.uid].id,
        ),
      ).toEqual(["src/lazy.js"]);
      assertReferences(data);
    });

    it("combines bundle and file patterns within each filter", async () => {
      const { data } = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: {
          include: { bundle: "entry.js", file: "/filtering/src/**" },
          exclude: { bundle: "entry.js", file: "**/keep.js" },
        },
      });
      expect(sortedIds(data)).toEqual(["src/入口😀.js"]);
      expect(Object.keys(metasById(data)["src/入口😀.js"].moduleParts)).toEqual(["entry.js"]);
      expect(metasById(data)["src/入口😀.js"].imported).toEqual([]);
      assertReferences(data);
    });

    it("preserves unfiltered graph-only and zero-size modules", async () => {
      const { data } = await generateFilteredReport(bundler, { sourcemap });
      const emptyFilters = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: { include: [], exclude: [] },
      });
      expect(emptyFilters.data).toEqual(data);
      const metas = metasById(data);
      expect(sortedIds(data)).toEqual(
        [
          ...Object.keys(filteringFiles).map((id) => id.slice(FILTER_ROOT.length)),
          "external-dep",
        ].sort(),
      );
      expect(Object.values(data.nodeMetas).flatMap((meta) => meta.imported)).toHaveLength(10);
      expect(metas["external-dep"].moduleParts).toEqual({});
      expect(metas["src/unused.js"].moduleParts).toEqual({});
      expect(metas["src/empty.js"]).toBeDefined();
      expect(metas["src/入口😀.js"].imported.some((link) => link.dynamic)).toBe(true);
      assertReferences(data);
    });

    it("uses empty bundle names only for genuine graph-only nodes", async () => {
      const baseline = await generateFilteredReport(bundler, { sourcemap });
      const { data } = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: { include: { bundle: "entry.js" } },
      });
      expect(
        Object.values(data.nodeMetas).every((meta) =>
          Object.keys(meta.moduleParts).includes("entry.js"),
        ),
      ).toBe(true);
      expect(metasById(data)["external-dep"]).toBeUndefined();
      expect(metasById(data)["src/unused.js"]).toBeUndefined();
      const excluded = await generateFilteredReport(bundler, {
        sourcemap,
        visualizer: { exclude: { bundle: "entry.js" } },
      });
      const original = metasById(baseline.data);
      expect(original["src/入口😀.js"].moduleParts["entry.js"]).toBeDefined();
      expect(metasById(excluded.data)["src/入口😀.js"]).toBeUndefined();
      expect(metasById(excluded.data)["external-dep"]).toBeDefined();
      assertReferences(data);
      assertReferences(excluded.data);
    });

    it.each([
      { exclude: { file: "**" } },
      { include: { file: "**/does-not-exist.js" } },
      { include: { bundle: "does-not-exist.js" } },
    ])("keeps entirely filtered reports empty: %j", async (visualizer) => {
      const { data } = await generateFilteredReport(bundler, { sourcemap, visualizer });
      assertEmpty(data);
    });
  });

  it.each(["map", "modules", "empty-map"] as const)(
    "preserves eligible missing-attribution fallbacks (%s) using UTF-8 byte sizes",
    async (withoutAttribution) => {
      const { data, chunks } = await generateFilteredReport(bundler, {
        sourcemap: true,
        withoutAttribution,
      });
      assertReferences(data);
      expect(Object.keys(data.nodeParts)).toHaveLength(chunks.size);
      for (const meta of Object.values(data.nodeMetas)) {
        for (const [bundle, uid] of Object.entries(meta.moduleParts)) {
          expect(data.nodeParts[uid].renderedLength).toBe(
            Buffer.byteLength(chunks.get(bundle)!.code, "utf8"),
          );
        }
      }
      expect(
        [...chunks.values()].some(
          (chunk) => Buffer.byteLength(chunk.code, "utf8") > chunk.code.length,
        ),
      ).toBe(true);
      const rejected = await generateFilteredReport(bundler, {
        sourcemap: true,
        withoutAttribution,
        visualizer: { exclude: { file: "**" } },
      });
      assertEmpty(rejected.data);
    },
  );

  it("retains zero-byte modules with real output membership", async () => {
    const id = `${FILTER_ROOT}src/empty.js`;
    const { data } = await generateFilteredReport(bundler, {
      files: { [id]: "export {};" },
      input: { entry: id },
    });
    expect(sortedIds(data)).toEqual(["src/empty.js"]);
    const uid = metasById(data)["src/empty.js"].moduleParts["entry.js"];
    expect(data.nodeParts[uid].renderedLength).toBe(0);
    expect(createChartData(data).nodes).toHaveLength(1);
    assertReferences(data);
  });

  it("does not create a missing-attribution fallback for an excluded facade", async () => {
    const { data } = await generateFilteredReport(bundler, {
      sourcemap: true,
      withoutAttribution: "modules",
      files: { [FILTER_ENTRY]: "export const x = 'é😀';" },
      visualizer: { exclude: { file: FILTER_ENTRY } },
    });
    assertEmpty(data);
  });

  it("preserves a non-sourcemap fallback when module attribution is unavailable", async () => {
    const { data, chunks } = await generateFilteredReport(bundler, {
      withoutAttribution: "modules",
    });
    expect(Object.keys(data.nodeParts)).toHaveLength(chunks.size);
    for (const meta of Object.values(data.nodeMetas)) {
      for (const [bundle, uid] of Object.entries(meta.moduleParts)) {
        expect(data.nodeParts[uid].renderedLength).toBe(
          Buffer.byteLength(chunks.get(bundle)!.code, "utf8"),
        );
      }
    }
    assertReferences(data);
  });

  it("filters synthetic fallback identities for shared chunks with no facade", async () => {
    const one = `${FILTER_ROOT}src/one.js`;
    const two = `${FILTER_ROOT}src/two.js`;
    const options = {
      withoutAttribution: "modules" as const,
      input: { one, two },
      files: {
        [one]: "import { shared } from './shared.js'; export const one = shared + Math.random();",
        [two]: "import { shared } from './shared.js'; export const two = shared + Math.random();",
        [`${FILTER_ROOT}src/shared.js`]: "export const shared = Math.random();",
      },
    };
    const before = await generateFilteredReport(bundler, options);
    const shared = [...before.chunks].find(([, chunk]) => chunk.facadeModuleId == null)!;
    expect(shared).toBeDefined();
    const fallbackId = `${shared[0]}-unknown`;
    expect(metasById(before.data)[fallbackId]).toBeDefined();
    const { data } = await generateFilteredReport(bundler, {
      ...options,
      visualizer: { exclude: { file: fallbackId } },
    });
    expect(metasById(data)[fallbackId]).toBeUndefined();
    expect(data.tree.children.some((tree) => tree.name === shared[0])).toBe(false);
    assertReferences(data);
  });

  it.each(["entrée😀.js", "space file.js", "literal%20%.js"])(
    "matches original source-map IDs for %s",
    async (name) => {
      const id = `${FILTER_ROOT}src/${name}`;
      const options = {
        sourcemap: true,
        input: { entry: id },
        files: { [id]: "export const value = Math.random();" },
      };
      const { data } = await generateFilteredReport(bundler, options);
      expect(sortedIds(data)).toEqual([`src/${name}`]);
      expect(Object.keys(metasById(data)[`src/${name}`].moduleParts)).toEqual(["entry.js"]);
      assertReferences(data);
      const excluded = await generateFilteredReport(bundler, {
        ...options,
        visualizer: { exclude: { file: id } },
      });
      assertEmpty(excluded.data);
    },
  );

  it("retains a source shared by allowed and excluded chunks with only its allowed size records", async () => {
    const shared = `${FILTER_ROOT}src/shared😀.js`;
    const left = `${FILTER_ROOT}src/left.js`;
    const right = `${FILTER_ROOT}src/right.js`;
    const files = {
      [left]: "export const left = Math.random();",
      [right]: "export const right = Math.random();",
    };
    const maps = Object.fromEntries(
      Object.keys(files).map((id) => {
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
    const options = { sourcemap: true, input: { left, right }, files, maps };
    const before = await generateFilteredReport(bundler, options);
    expect(Object.keys(metasById(before.data)["src/shared😀.js"].moduleParts).sort()).toEqual([
      "left.js",
      "right.js",
    ]);
    const { data } = await generateFilteredReport(bundler, {
      ...options,
      visualizer: { exclude: { bundle: "left.js" } },
    });
    expect(Object.keys(metasById(data)["src/shared😀.js"].moduleParts)).toEqual(["right.js"]);
    expect(metasById(data)["src/left.js"]).toBeUndefined();
    assertReferences(data);
    const none = await generateFilteredReport(bundler, {
      ...options,
      visualizer: { exclude: { bundle: "*.js" } },
    });
    assertEmpty(none.data);
  });
});

describe("Vite report filters", () => {
  it.each([false, true])("filters actual Vite output (sourcemap: %s)", async (sourcemap) => {
    const { data } = await generateFilteredReport("vite", {
      sourcemap,
      visualizer: { exclude: packageExclusions },
    });
    expect(
      Object.values(data.nodeMetas).some((meta) => /date-fns|lodash-es|lucide-react/.test(meta.id)),
    ).toBe(false);
    expect(metasById(data)["node_modules/kept-util/index.js"]).toBeDefined();
    expect(
      Object.values(data.nodeMetas)
        .flatMap((meta) => meta.imported)
        .some((link) => link.dynamic),
    ).toBe(true);
    assertReferences(data);
    const empty = await generateFilteredReport("vite", {
      sourcemap,
      visualizer: { exclude: { file: "**" } },
    });
    assertEmpty(empty.data);
  });
});

describe("Empty report data", () => {
  it.each([false, true])(
    "preserves graph-only nodes in empty size reports when present: %s",
    async (graphOnly) => {
      const { data, reports } = await generateFilteredReport("rollup", {
        visualizer: graphOnly ? { include: { file: "external-dep" } } : { exclude: { file: "**" } },
        templates: [...FILTER_HTML, "markdown", "list"],
      });
      if (graphOnly) {
        expect(sortedIds(data)).toEqual(["external-dep"]);
        expect(data.tree.children).toEqual([]);
        assertReferences(data);
      } else {
        assertEmpty(data);
      }
      expect(reports.list).toBe("");
      expect(reports.markdown).toContain(`| 0 | 0 | 0 | ${graphOnly ? 1 : 0} | 0 | 0 |`);
    },
  );
});
