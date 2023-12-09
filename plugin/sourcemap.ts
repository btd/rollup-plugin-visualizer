import path from "path";
import { OutputChunk } from "rollup";
import type { RawSourceMap } from "source-map";
import { SourceMapConsumer } from "source-map";

interface SourceMapModuleRenderInfo {
  id: string;
  renderedLength: number;
  code: string[];
}

const getBytesPerFileUsingSourceMap = (
  bundleId: string,
  code: string,
  map: SourceMapConsumer,
  dir: string,
) => {
  const modules: Record<string, SourceMapModuleRenderInfo> = {};

  let line = 1;
  let column = 0;
  const codeChars = [...code];
  for (let i = 0; i < codeChars.length; i++, column++) {
    const { source } = map.originalPositionFor({
      line,
      column,
    });
    if (source != null) {
      const id = path.resolve(path.dirname(path.join(dir, bundleId)), source);

      const char = codeChars[i];

      modules[id] = modules[id] || { id, renderedLength: 0, code: [] };
      modules[id].renderedLength += Buffer.byteLength(char);
      modules[id].code.push(char);
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
  dir: string,
): Promise<Record<string, SourceMapModuleRenderInfo>> => {
  if (outputChunk.map == null) {
    return Promise.resolve({});
  }
  return SourceMapConsumer.with(outputChunk.map as RawSourceMap, null, (map) => {
    return getBytesPerFileUsingSourceMap(id, outputChunk.code, map, dir);
  });
};
