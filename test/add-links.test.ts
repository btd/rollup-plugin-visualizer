import { describe, expect, it, vi } from "vitest";
import { addLinks } from "../plugin/data.js";
import { ModuleMapper } from "../plugin/module-mapper.js";
import { visualizer } from "../plugin/index.js";
import {
  BundlerModuleInfo,
  BundlerOutputBundle,
  BundlerPluginContext,
} from "../plugin/bundler-types.js";
import { VisualizerData } from "../shared/types.js";

describe("addLinks", () => {
  it("visits a shared graph once per report while preserving the emitted links", async () => {
    const pageCount = 100;
    const pages = Array.from({ length: pageCount }, (_, index) => `page${index}`);
    const modules: Record<string, BundlerModuleInfo> = {
      router: {
        isEntry: true,
        importedIds: [],
        dynamicallyImportedIds: pages,
      },
    };
    for (const page of pages) {
      modules[page] = { isEntry: true, importedIds: ["router", "shared"] };
    }
    modules.shared = { isEntry: false, importedIds: [] };

    const outputBundle: BundlerOutputBundle = Object.fromEntries(
      pages.map((page) => [
        `${page}.js`,
        {
          type: "chunk",
          code: page,
          modules: { [page]: { renderedLength: page.length, code: page } },
          facadeModuleId: page,
        },
      ]),
    );
    const getModuleInfo = vi.fn((id: string) => modules[id] ?? null);
    const emitFile = vi.fn(
      (_file: Parameters<BundlerPluginContext["emitFile"]>[0]) => "stats-asset",
    );
    const context: BundlerPluginContext = {
      meta: { rollupVersion: "test" },
      getModuleInfo,
      emitFile,
      warn: vi.fn(),
      error: (message) => {
        throw new Error(message);
      },
    };
    const plugin = visualizer({ template: "raw-data", filename: "stats.json", emitFile: true });

    await plugin.generateBundle.call(context, { sourcemap: false }, outputBundle);

    expect(getModuleInfo).toHaveBeenCalledTimes(pageCount + 2);
    expect(emitFile).toHaveBeenCalledTimes(1);
    const data = JSON.parse(emitFile.mock.calls[0][0].source) as VisualizerData;
    expect(data.tree.children).toHaveLength(pageCount);
    const metas = Object.values(data.nodeMetas);
    const byId = Object.fromEntries(metas.map((meta) => [meta.id, meta]));
    const idByUid = Object.fromEntries(
      Object.entries(data.nodeMetas).map(([uid, meta]) => [uid, meta.id]),
    );
    expect(byId.router.imported.map(({ uid, dynamic }) => [idByUid[uid], dynamic])).toEqual(
      pages.map((page) => [page, true]),
    );
    expect(byId.shared.importedBy.map(({ uid }) => idByUid[uid])).toEqual(pages);
    for (const page of pages) {
      expect(byId[page].imported.map(({ uid }) => idByUid[uid])).toEqual(["router", "shared"]);
      expect(byId[page].importedBy.map(({ uid }) => idByUid[uid])).toEqual(["router"]);
    }

    await plugin.generateBundle.call(context, { sourcemap: false }, outputBundle);
    expect(getModuleInfo).toHaveBeenCalledTimes((pageCount + 2) * 2);
  });

  it("continues past a missing module to process other queued links", () => {
    const getModuleInfo = vi.fn((id: string) => {
      if (id === "entry") return { isEntry: true, importedIds: ["missing", "present"] };
      if (id === "present") return { isEntry: false, importedIds: ["deep"] };
      if (id === "deep") return { isEntry: false, importedIds: [] };
      return null;
    });
    const mapper = new ModuleMapper("");

    addLinks("entry", getModuleInfo, mapper);

    expect(getModuleInfo.mock.calls.map(([id]) => id)).toEqual([
      "entry",
      "missing",
      "present",
      "deep",
    ]);
  });
});
