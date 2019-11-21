"use strict";

const path = require("path");

const { SourceMapConsumer } = require("source-map");

const getBytesPerFileUsingSourceMap = (code, map) => {
  const lines = code.split(/[\r\n]/);

  const bytesPerFile = {};

  // For every byte in the minified code, do a sourcemap lookup.
  for (let line = 0; line < lines.length; line++) {
    for (let col = 0; col < lines[line].length; col++) {
      const result = map.originalPositionFor({ line: line + 1, column: col });
      const source = result.source || "root";
      if (!bytesPerFile[source]) {
        bytesPerFile[source] = 0;
      }
      bytesPerFile[source]++;
    }
  }
  return Object.keys(bytesPerFile).map(file => ({
    file: path.resolve(file),
    bytes: bytesPerFile[file]
  }));
};

// Given a file C:/path/to/file/on/filesystem.js
// - remove extension
// - strip filesystem root
// - return path segments, starting from the tail and working backwards
// segments('C:/path/to/file/on/filesystem.js') === ['filesystem', 'on', 'file', 'to', 'path']
const segments = filepath => {
  const parsed = path.parse(filepath);
  const dirWithoutRoot = parsed.dir.substring(parsed.root.length);

  return dirWithoutRoot
    .split(path.sep)
    .concat(parsed.name)
    .reverse();
};

const findBestMatchingModule = (filename, entries) => {
  const filenameSegments = segments(filename);

  for (let i = 1; i <= filenameSegments.length; i++) {
    const leftVals = filenameSegments.slice(0, i);

    const match = entries.find(([id]) => {
      const moduleSegments = segments(id);
      const rightVals = moduleSegments.slice(0, i);
      if (rightVals.length !== leftVals.length) {
        return false;
      }
      return rightVals.every((rightVal, i) => rightVal === leftVals[i]);
    });

    if (match != null) {
      return match[0];
    }
  }

  return null;
};

// Adds a .minifiedSize property to each module in the bundle (using sourcemap data)
// If the minified size could not be computed, no property is added.
// Module id are mapped to sources by finding the best match.
// Matching is done by removing the file extensions and comparing path segments
const addMinifiedSizesToModules = (bundle, computedLengths) => {
  const modulesEntries = Object.entries(bundle.modules);

  return SourceMapConsumer.with(bundle.map, null, map => {
    const sourcemapEntries = getBytesPerFileUsingSourceMap(bundle.code, map);
    for (const { file, bytes } of sourcemapEntries) {
      const id = findBestMatchingModule(file, modulesEntries);
      if (id) {
        computedLengths[id] = computedLengths[id] || {};
        computedLengths[id].sourcemapLength = bytes;
      }
    }
  });
};

module.exports = addMinifiedSizesToModules;
