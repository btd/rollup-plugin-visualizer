import path from "node:path";
import { describe, expect, it } from "vitest";
import { SourceMapConsumer } from "source-map";
import type { RawSourceMap } from "source-map";
import { rollup } from "rollup";
import { rolldown } from "rolldown";
import terser from "@rollup/plugin-terser";
import { getSourcemapModules } from "../dist/plugin/sourcemap.js";
import { visualizer } from "../dist/plugin/index.js";
import type { VisualizerData } from "../shared/types.js";

const dir = path.resolve("temp");
const projectRoot = process.cwd();

const toReportId = (id: string) => (id.startsWith(projectRoot) ? id.slice(projectRoot.length) : id);

const reportSizes = (data: VisualizerData) =>
  Object.fromEntries(
    Object.values(data.nodeParts).map((part) => [
      data.nodeMetas[part.metaUid].id,
      part.renderedLength,
    ]),
  );

// Independent oracle for the actual bundler output: walk code points, advance
// columns in UTF-16, and count UTF-8 bytes using the public consumer lookup.
const referenceSizes = (code: string, rawMap: RawSourceMap) =>
  SourceMapConsumer.with(rawMap, null, (map) => {
    const result: Record<string, number> = {};
    let line = 1;
    let column = 0;
    for (const char of code) {
      const { source } = map.originalPositionFor({ line, column });
      if (source != null) {
        const id = toReportId(path.resolve(dir, source));
        result[id] = (result[id] ?? 0) + Buffer.byteLength(char);
      }
      if (char === "\n") {
        line++;
        column = 0;
      } else {
        column += char.length;
      }
    }
    return result;
  });

const files: Record<string, string> = {
  "/src/index.js":
    'import { a } from "./a.js";\r\nimport { b } from "./b.js";\r\nconsole.log(a, b);',
  "/src/a.js": `export const a = "${"😀".repeat(100)}";`,
  "/src/b.js": `export const b = "${"x".repeat(300)}";`,
};

for (const bundler of ["rollup", "rolldown"] as const) {
  for (const format of ["es", "cjs"] as const) {
    for (const minify of [false, true]) {
      describe(`${bundler}, ${format}, minify=${minify}`, () => {
        it.each(["issue-225", "encoding"])(
          "attributes %s using the emitted map",
          async (fixture) => {
            const input =
              fixture === "issue-225" ? "/src/index.js" : "test/sourcemap-encoding/input.js";
            const plugins = [
              {
                name: "issue-225-fixture",
                resolveId: (id: string) => {
                  if (fixture !== "issue-225") return null;
                  return id.startsWith(".") ? `/src/${id.slice(2)}` : id;
                },
                load: (id: string) => files[id],
              },
              visualizer({
                template: "raw-data",
                filename: "stats.json",
                emitFile: true,
                sourcemap: true,
              }),
            ];
            const bundle =
              bundler === "rollup"
                ? await rollup({ input, plugins })
                : await rolldown({ input, plugins });
            try {
              const { output } = await bundle.generate({
                format,
                file: path.join(dir, "out.js"),
                sourcemap: true,
                // Exercise generated wrappers and unmapped banner/footer text too.
                ...(fixture === "encoding"
                  ? { banner: "/* generated banner 😀 */", footer: "/* generated footer 😀 */" }
                  : {}),
                ...(bundler === "rollup" ? { plugins: minify ? [terser()] : [] } : { minify }),
              });
              const chunk = output.find((file) => file.type === "chunk");
              const stats = output.find((file) => file.fileName === "stats.json");
              if (chunk?.type !== "chunk" || stats?.type !== "asset")
                throw new Error("Missing output");
              expect(chunk.map).toHaveProperty("mappings", expect.any(String));
              const data = JSON.parse(String(stats.source)) as VisualizerData;
              const rendered = reportSizes(data);
              expect(Object.keys(rendered).length).toBeGreaterThan(0);
              if (!minify) {
                expect(Object.keys(rendered)).toHaveLength(fixture === "issue-225" ? 3 : 2);
              }
              expect(rendered).toEqual(await referenceSizes(chunk.code, chunk.map as RawSourceMap));
              if (fixture === "issue-225" && bundler === "rollup" && format === "es" && minify) {
                expect(rendered).toEqual({
                  "/src/index.js": 12,
                  "/src/a.js": 403,
                  "/src/b.js": 305,
                });
              }
            } finally {
              await bundle.close();
            }
          },
        );
      });
    }
  }
}

it.each(["rollup", "rolldown"] as const)(
  "%s keeps modules with the same filename in different directories separate",
  async (bundler) => {
    const sameNameFiles: Record<string, string> = {
      "/same-name/index.js":
        'import "./left/shared.js"; import "./right/shared.js"; console.log(globalThis.sameNameLeft, globalThis.sameNameRight);',
      "/same-name/left/shared.js": 'globalThis.sameNameLeft = "😀left";',
      "/same-name/right/shared.js": `globalThis.sameNameRight = "right-${"x".repeat(40)}";`,
    };
    const plugins = [
      {
        name: "same-filename-fixture",
        resolveId: (id: string) => (id.startsWith(".") ? path.posix.resolve("/same-name", id) : id),
        load: (id: string) => sameNameFiles[id],
      },
      visualizer({
        template: "raw-data",
        filename: "stats.json",
        emitFile: true,
        sourcemap: true,
      }),
    ];
    const bundle =
      bundler === "rollup"
        ? await rollup({ input: "/same-name/index.js", plugins })
        : await rolldown({ input: "/same-name/index.js", plugins });
    try {
      const { output } = await bundle.generate({
        format: "es",
        file: path.join(dir, "out.js"),
        sourcemap: true,
      });
      const chunk = output.find((file) => file.type === "chunk");
      const stats = output.find((file) => file.fileName === "stats.json");
      if (chunk?.type !== "chunk" || stats?.type !== "asset") throw new Error("Missing output");

      const rendered = reportSizes(JSON.parse(String(stats.source)) as VisualizerData);
      expect(rendered).toEqual(await referenceSizes(chunk.code, chunk.map as RawSourceMap));
      expect(rendered).toHaveProperty("/same-name/left/shared.js");
      expect(rendered).toHaveProperty("/same-name/right/shared.js");
      expect(rendered["/same-name/left/shared.js"]).not.toBe(
        rendered["/same-name/right/shared.js"],
      );
    } finally {
      await bundle.close();
    }
  },
);

it.each([undefined, null])("returns no module sizes for an absent map: %j", async (map) => {
  expect(
    await getSourcemapModules(
      "out.js",
      {
        type: "chunk",
        code: "",
        map,
        modules: {},
        facadeModuleId: null,
      },
      dir,
    ),
  ).toEqual({});
});
