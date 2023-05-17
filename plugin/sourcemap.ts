import path from "path";
import { OutputChunk } from "rollup";
import { SourceMapConsumer } from "source-map";

interface SourceMapModuleRenderInfo {
  id: string;
  code: string;
}

const getBytesPerFileUsingSourceMap = (
  bundleId: string,
  code: string,
  map: SourceMapConsumer,
  dir: string
) => {
  const modules: Record<string, SourceMapModuleRenderInfo> = {};

  let line = 1;
  let column = 0;
  for (let i = 0; i < code.length; i++, column++) {
    const { source } = map.originalPositionFor({
      line,
      column,
    });
    if (source != null) {
      const id = path.resolve(path.dirname(path.join(dir, bundleId)), source);

      modules[id] = modules[id] || { id, code: "" };
      modules[id].code += code[i];
    }

    if (code[i] === "\n") {
      line += 1;
      column = -1;
    }
  }

  return modules;
};

export const getSourcemapModules = (
  id: string,
  outputChunk: OutputChunk,
  dir: string
): Promise<Record<string, SourceMapModuleRenderInfo>> => {
  if (!outputChunk.map) {
    return Promise.resolve({});
  }
  return SourceMapConsumer.with(outputChunk.map, null, (map) => {
    return getBytesPerFileUsingSourceMap(id, outputChunk.code, map, dir);
  });
};
