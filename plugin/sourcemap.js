"use strict";

const path = require("path");
const { SourceMapConsumer } = require("source-map");

const UNKNOWN_SOURCE = "\u0000unknown";

const getBytesPerFileUsingSourceMap = (bundleId, code, map, dir) => {
  const modules = Object.create(null);

  let line = 1;
  let column = 0;
  for (let i = 0; i < code.length; i++, column++) {
    const { source } = map.originalPositionFor({
      line,
      column
    });
    const id =
      source == null
        ? `${UNKNOWN_SOURCE}-${bundleId}`
        : path.resolve(dir, source);

    modules[id] = modules[id] || { renderedLength: 0 };
    modules[id].renderedLength += 1;

    if (code[i] === "\n") {
      line += 1;
      column = -1;
    }
  }

  return modules;
};

const getSourcemapModules = (id, { map, code }, dir) => {
  return SourceMapConsumer.with(map, null, map => {
    return getBytesPerFileUsingSourceMap(id, code, map, dir);
  });
};

module.exports = getSourcemapModules;
