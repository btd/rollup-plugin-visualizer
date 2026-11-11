import path from "node:path";
import { rollup } from "rollup";
import { rolldown, type RolldownPlugin } from "rolldown";
import { visualizer } from "../dist/plugin/index.js";
import type { VisualizerData } from "../shared/types";

export const networkFiles = (count: number) => {
  const files: Record<string, string> = {
    "/network/node_modules/react/index.js": "export const h = x => x + Math.random();",
  };
  const imports: string[] = [];
  for (const pkg of ["@scope/alpha", "@scope/beta", "gamma"]) {
    for (let i = 0; i < count; i++) {
      const id = `/network/node_modules/${pkg}/file${i}.js`;
      files[id] = `
        import { h } from '/network/node_modules/react/index.js';
        ${i ? `import { f as previous } from './file${i - 1}.js';` : ""}
        export const f = x => h(x) ${i ? "+ previous(x)" : ""};
      `;
    }
    imports.push(
      `import { f as f${imports.length} } from '/network/node_modules/${pkg}/file${count - 1}.js';`,
    );
  }
  files["/network/src/入口😀.js"] = `${imports.join("\n")} console.log(f0(1), f1(2), f2(3));`;
  return files;
};

export const generateNetworkData = async (
  bundler: "rollup" | "rolldown",
  files: Record<string, string>,
  input: string | string[] = "/network/src/入口😀.js",
) => {
  const options = {
    input,
    plugins: [
      {
        name: "network-fixture",
        resolveId(id: string, importer?: string) {
          return id.startsWith(".") ? path.posix.resolve(path.posix.dirname(importer!), id) : id;
        },
        load(id: string) {
          return files[id];
        },
      },
      visualizer({
        template: "raw-data",
        emitFile: true,
        filename: "network.json",
        projectRoot: "/network/",
      }),
    ],
  };
  const bundle =
    bundler === "rollup"
      ? await rollup(options)
      : await rolldown({ ...options, plugins: options.plugins as RolldownPlugin[] });
  try {
    const { output } = await bundle.generate({ format: "es", entryFileNames: "[name].js" });
    const report = output.find((file) => file.type === "asset" && file.fileName === "network.json");
    if (!report || report.type !== "asset") throw new Error("Missing network report");
    return JSON.parse(String(report.source)) as VisualizerData;
  } finally {
    await bundle.close();
  }
};
