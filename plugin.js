"use strict";

const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const util = require("util");
const opn = require("opn");
const SourceMapConsumer = require("source-map").SourceMapConsumer;

const writeFileAsync = util.promisify(fs.writeFile);
const mkdirpAsync = util.promisify(mkdirp);

const readFont = (type = "woff", weight = 700) => {
  const fonts = path.join(require.resolve("typeface-oswald"), "../files/");
  return fs.readFileSync(path.join(fonts, `./oswald-latin-${weight}.${type}`));
};

const cssString = fs.readFileSync(path.join(__dirname, "lib", "./style.css"), "utf8");
const jsString = fs.readFileSync(path.join(__dirname, "lib", "./pluginmain.js"), "utf8");
const fontWeight = 500;
const fontface = buildFontface("Oswald", fontWeight, {
  woff: readFont("woff", fontWeight).toString("base64"),
  woff2: readFont("woff2", fontWeight).toString("base64")
});

const PLUGIN_PREFIX = "\u0000";

module.exports = function(opts) {
  opts = opts || {};
  const filename = opts.filename || "stats.html";
  const title = opts.title || "RollUp Visualizer";
  const useSourceMap = !!opts.sourcemap;
  const open = !!opts.open;
  const openOptions = opts.openOptions || {};

  return {
    async generateBundle(outputOptions, outputBundle) {
      const roots = [];

      for (const [id, bundle] of Object.entries(outputBundle)) {
        //console.log(id, bundle);
        if (bundle.isAsset) continue; //only chunks

        if (useSourceMap) {
          await addMinifiedSizesToModules(bundle);
        }
        const root = buildTree(bundle, useSourceMap);

        flattenTree(root);
        roots.push({ id, root });
      }
      const html = buildHtml(title, roots, filename);
      await writeFile(filename, html);
      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};

function buildTree(bundle, useSourceMap) {
  const root = {
    name: "root",
    children: []
  };
  Object.keys(bundle.modules).forEach(id => {
    const module = bundle.modules[id];
    const name = id;
    const m = {
      size: useSourceMap ? module.minifiedSize || 0 : module.renderedLength,
      originalSize: module.originalLength
    };

    if (name.indexOf(PLUGIN_PREFIX) === 0) {
      addToPath(root, [name], m);
    } else {
      addToPath(root, name.split(path.sep), m);
    }
  });
  return root;
}

function buildHtml(title, root) {
  return `<!doctype html>
      <title>${title}</title>
      <meta charset="utf-8">
      <style>${cssString}\n${fontface}</style>
      <div>
      <div>
          <h1>${title}</h1>

          <div id="charts">
          </div>
      </div>
      </div>
      <script>window.nodesData = ${JSON.stringify(root)};</script>
      <script charset="UTF-8">
        ${jsString}
      </script>
  `;
}

function buildFontface(name, weight, { woff2, woff }) {
  return `
    @font-face {
      font-family: '${name}';
      font-display: swap;
      font-style: normal;
      font-weight: ${weight};
      src:
        url(data:font/woff2;charset=utf-8;base64,${woff2}) format('woff2'),
        url(data:application/font-woff;charset=utf-8;base64,${woff}) format('woff');
    }`;
}

async function writeFile(filename, contents) {
  await mkdirpAsync(path.dirname(filename));
  return await writeFileAsync(filename, contents);
}

function getDeepMoreThenOneChild(tree) {
  if (tree.children && tree.children.length === 1) {
    return getDeepMoreThenOneChild(tree.children[0]);
  }
  return tree;
}

// if root children have only on child we can flatten this
function flattenTree(root) {
  let newChildren = [];
  root.children.forEach(child => {
    const commonParent = getDeepMoreThenOneChild(child);
    if (commonParent.children.length === 0) {
      newChildren.push(commonParent);
    } else {
      newChildren = newChildren.concat(commonParent.children);
    }
  });
  root.children = newChildren;
}

function addToPath(tree, p, value) {
  if (p[0] === "") {
    p.shift();
  }

  let child = tree.children.filter(c => c.name === p[0])[0];
  if (!child) {
    child = {
      name: p[0],
      children: []
    };
    tree.children.push(child);
  }
  if (p.length === 1) {
    Object.assign(child, value);
    return;
  }
  p.shift();
  addToPath(child, p, value);
}

function getBytesPerFileUsingSourceMap(code, map) {
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
}

// Given a file C:/path/to/file/on/filesystem.js
// - remove extension
// - strip filesystem root
// - return path segments, starting from the tail and working backwards
// segments('C:/path/to/file/on/filesystem.js') === ['filesystem', 'on', 'file', 'to', 'path']
function segments(filepath) {
  const parsed = path.parse(filepath);
  const dirWithoutRoot = parsed.dir.substring(parsed.root.length);

  return dirWithoutRoot
    .split(path.sep)
    .concat(parsed.name)
    .reverse();
}

// Adds a .minifiedSize property to each module in the bundle (using sourcemap data)
// If the minified size could not be computed, no property is added.
// Module id are mapped to sources by finding the best match.
// Matching is done by removing the file extensions and comparing path segments
function addMinifiedSizesToModules(bundle) {
  const findBestMatchingModule = filename => {
    const filenameSegments = segments(filename);

    for (let i = 1; i <= filenameSegments.length; i++) {
      const leftVals = filenameSegments.slice(0, i);

      const matches = Object.keys(bundle.modules).filter(id => {
        const moduleSegments = segments(id);
        const rightVals = moduleSegments.slice(0, i);
        if (rightVals.length !== leftVals.length) {
          return false;
        }
        return rightVals.every((rightVal, i) => rightVal === leftVals[i]);
      });

      if (matches.length === 1) {
        return bundle.modules[matches[0]];
      }
    }

    return null;
  };

  return SourceMapConsumer.with(bundle.map, null, map => {
    const fileSizes = getBytesPerFileUsingSourceMap(bundle.code, map);
    fileSizes.forEach(tuple => {
      const module = findBestMatchingModule(tuple.file);
      if (module) {
        module.minifiedSize = tuple.bytes;
      }
    });
  });
}
