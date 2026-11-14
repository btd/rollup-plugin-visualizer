import type { VisualizerData } from "../shared/types.js";

export const shareFixture = (): VisualizerData => ({
  version: 2,
  tree: {
    name: "📦 report",
    children: [
      { name: "empty", children: [] },
      { name: "🐢é / é.js", uid: "part-00" },
      { name: "zero", uid: "other-4" },
    ],
    isRoot: true,
  } as VisualizerData["tree"],
  nodeParts: {
    "part-00": {
      metaUid: "α-00",
      renderedLength: Number.MAX_SAFE_INTEGER,
      gzipLength: 4_294_967_296,
      brotliLength: 0,
    },
    "other-4": { metaUid: "α-00", renderedLength: 0, gzipLength: 0, brotliLength: 0 },
  },
  nodeMetas: {
    "α-00": {
      id: "/🐢é/文件.js",
      moduleParts: { "β.bundle.js": "part-00", "zero.js": "other-4" },
      isEntry: false,
      imported: [
        { uid: "other-prefix-2", dynamic: false },
        { uid: "other-prefix-2", dynamic: true },
      ],
      importedBy: [{ uid: "other-prefix-2", dynamic: false }],
    },
    "other-prefix-2": {
      id: "\u0000/🐢é/file.js",
      moduleParts: {},
      isExternal: true,
      imported: [{ uid: "α-00", dynamic: false }],
      importedBy: [
        { uid: "α-00", dynamic: true },
        { uid: "α-00", dynamic: false },
      ],
    },
  },
  env: { array: [null, 1.25, true, "🐢", { x: false }], nested: { answer: 42 } },
  options: { gzip: true, brotli: false, sourcemap: false },
});

export const emptyShareFixture = (): VisualizerData => ({
  version: 2,
  tree: { name: "root", children: [] },
  nodeParts: {},
  nodeMetas: {},
  env: {},
  options: { gzip: false, brotli: false, sourcemap: false },
});
