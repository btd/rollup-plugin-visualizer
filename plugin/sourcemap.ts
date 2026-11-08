import path from "node:path";
import { BundlerOutputChunk } from "./bundler-types.js";
import type { RawSourceMap } from "source-map";
import { SourceMapConsumer } from "source-map";

interface SourceMapModuleRenderInfo {
  id: string;
  renderedLength: number;
}

interface GeneratedMapping {
  generatedLine: number;
  generatedColumn: number;
  source: string | null;
}

const getBytesPerFileUsingSourceMap = (
  bundleId: string,
  code: string,
  map: SourceMapConsumer,
  dir: string,
) => {
  const modules: Record<string, SourceMapModuleRenderInfo> = {};
  const modulesBySource = new Map<string, SourceMapModuleRenderInfo>();
  const bundleDir = path.dirname(path.join(dir, bundleId));

  let line = 1;
  let lineStart = 0;
  let lineEnd = 0;
  let previous: GeneratedMapping | undefined;

  const countSpan = (next?: GeneratedMapping): void => {
    if (previous?.source == null) return;
    // Columns and string offsets both use UTF-16; only the size uses UTF-8.
    const start = Math.min(lineStart + previous.generatedColumn, lineEnd);
    const end =
      next?.generatedLine === previous.generatedLine
        ? Math.min(lineStart + next.generatedColumn, lineEnd)
        : lineEnd;
    if (end <= start) return;

    let module = modulesBySource.get(previous.source);
    if (module == null) {
      const id = path.resolve(bundleDir, previous.source);
      module = modules[id] ??= { id, renderedLength: 0 };
      modulesBySource.set(previous.source, module);
    }
    module.renderedLength += Buffer.byteLength(code.slice(start, end));
  };

  // Rollup and Rolldown emit flat maps. Stream their generated mappings without
  // materializing characters or retaining the generated code for each module.
  map.eachMapping(
    (mapping) => {
      // Original positions within the same source do not affect module sizes.
      if (previous?.generatedLine === mapping.generatedLine && previous.source === mapping.source) {
        return;
      }
      countSpan(mapping);

      while (line < mapping.generatedLine && lineStart < code.length) {
        const newline = code.indexOf("\n", lineStart);
        lineStart = newline === -1 ? code.length : newline + 1;
        line++;
      }
      if (previous?.generatedLine !== mapping.generatedLine) {
        const newline = code.indexOf("\n", lineStart);
        // Preserve the existing policy: include a mapped line's terminating LF,
        // but do not extend its final mapping into an unmapped following line.
        lineEnd = newline === -1 ? code.length : newline + 1;
      }
      previous = mapping;
    },
    null,
    SourceMapConsumer.GENERATED_ORDER,
  );
  countSpan();

  return modules;
};

export const getSourcemapModules = (
  id: string,
  outputChunk: BundlerOutputChunk,
  dir: string,
): Promise<Record<string, SourceMapModuleRenderInfo>> => {
  if (outputChunk.map == null) {
    return Promise.resolve({});
  }
  return SourceMapConsumer.with(outputChunk.map as RawSourceMap, null, (map) => {
    return getBytesPerFileUsingSourceMap(id, outputChunk.code, map, dir);
  });
};
