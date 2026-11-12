import path from "node:path";
import { rollup } from "rollup";
import { rolldown } from "rolldown";
import { describe, expect, it, vi } from "vitest";
import { collectReport, selectReport, buildReport } from "../dist/plugin/report.js";
import type {
  BundlerNormalizedOutputOptions,
  BundlerOutputBundle,
  BundlerPluginContext,
} from "../plugin/bundler-types";

describe.each(["rollup", "rolldown"] as const)("Report selection from %s", (bundler) => {
  it.each([false, true])(
    "selects before measurement without modifying collected facts (sourcemap: %s)",
    async (sourcemap) => {
      const files: Record<string, string> = {
        "/selection/entry.js":
          "import { kept } from './keep.js'; import { skipped } from './skip.js'; console.log(kept, skipped);",
        "/selection/keep.js": "export const kept = Math.random();",
        "/selection/skip.js": "export const skipped = Math.random();",
      };
      let inspected = false;
      const options = {
        input: "/selection/entry.js",
        plugins: [
          {
            name: "selection-fixture",
            resolveId(id: string, importer?: string) {
              return id.startsWith(".")
                ? path.posix.resolve(path.posix.dirname(importer!), id)
                : id;
            },
            load: (id: string) => files[id],
            async generateBundle(
              this: BundlerPluginContext,
              outputOptions: BundlerNormalizedOutputOptions,
              output: BundlerOutputBundle,
            ) {
              const collected = await collectReport(output, {
                sourcemap,
                dir: outputOptions.dir!,
                getModuleInfo: this.getModuleInfo.bind(this),
                warn: this.warn.bind(this),
              });
              const facts = structuredClone(collected);
              const selected = selectReport(collected, undefined, { file: "**/skip.js" });
              const selection = structuredClone(selected);
              const measure = vi.fn(async ({ id, code }: { id: string; code: string | null }) => {
                if (id.endsWith("/skip.js")) throw new Error("Excluded code must not be measured");
                return {
                  id,
                  renderedLength: Buffer.byteLength(code ?? "", "utf8"),
                  gzipLength: 0,
                  brotliLength: 0,
                };
              });
              const report = await buildReport(selected, "/selection/", measure);
              expect(
                Object.values(report.nodeMetas)
                  .map((module) => module.id)
                  .sort(),
              ).toEqual(["entry.js", "keep.js"]);
              expect(Object.keys(report.nodeParts)).toHaveLength(2);
              expect(measure.mock.calls.map(([part]) => part.id).sort()).toEqual(
                sourcemap ? [] : ["/selection/entry.js", "/selection/keep.js"],
              );
              expect(selected).toEqual(selection);

              // A different selection can reuse the original collection, including
              // the contribution that was absent from the first generated report.
              const onlySkipped = selectReport(collected, { file: "**/skip.js" }, undefined);
              expect([...onlySkipped.modules.keys()]).toEqual(["/selection/skip.js"]);
              expect(onlySkipped.links).toEqual([]);
              expect(collected).toEqual(facts);

              const none = selectReport(collected, undefined, { file: "**" });
              const mustNotMeasure = vi.fn(async () => {
                throw new Error("Empty selections must not be measured");
              });
              const empty = await buildReport(none, "/selection/", mustNotMeasure);
              expect(empty.tree.children).toEqual([]);
              expect(empty.nodeMetas).toEqual({});
              expect(empty.nodeParts).toEqual({});
              expect(mustNotMeasure).not.toHaveBeenCalled();
              inspected = true;
            },
          },
        ],
      };
      const bundle = bundler === "rollup" ? await rollup(options) : await rolldown(options);
      try {
        await bundle.generate({ format: "es", dir: "/selection/dist", sourcemap });
        expect(inspected).toBe(true);
      } finally {
        await bundle.close();
      }
    },
  );
});
