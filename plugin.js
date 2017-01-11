const fs = require('fs');
const path = require('path');
const SourceMapConsumer = require('source-map').SourceMapConsumer;

const cssString = fs.readFileSync(path.join(__dirname, 'lib', './style.css'), 'utf8');
const jsString = fs.readFileSync(path.join(__dirname, 'lib', './pluginmain.js'), 'utf8');

const COMMONJS_PLUGIN_PREFIX = '\u0000commonjs-proxy:';


module.exports = function(opts) {
  opts = opts || {};
  var filename = opts.filename || 'stats.html';
  var useSourceMap = !!opts.sourcemap;

  return {
    ongenerate({ bundle }, rendered) {

      let root = {
        name: 'root',
        children: []
      };

      if (useSourceMap) {
        addMinifiedSizesToModules(bundle, rendered);
      }

      bundle.modules.forEach(module => {
        let name = module.id;
        let m = {
          //dependencies: module.dependencies,
          size: useSourceMap ? (module.minifiedSize || 0) : Buffer.byteLength(module.code, 'utf8'),
          originalSize: Buffer.byteLength(module.originalCode, 'utf8')
        };

        if (name.indexOf(COMMONJS_PLUGIN_PREFIX) === 0) {
          m.name = COMMONJS_PLUGIN_PREFIX;
          m = {
            plugin: [
              m
            ]
          };
          name = name.substr(COMMONJS_PLUGIN_PREFIX.length);
        }

        addToPath(root, name.split(path.sep), m);

      });
      flattenTree(root);

      var html = `<!doctype html>
          <title>RollUp Visualizer</title>
          <meta charset="utf-8">
          <style>${cssString}</style>
          <div>
          <div>
              <h1>RollUp Visualizer</h1>

              <div id="chart">
                <div class="details" style="display: none;">
                  <span class="details-name"></span>
                  <div class="details-percentage"></div>
                  of bundle size
                  <div class="details-size"></div>
                </div>
              </div>
          </div>
          </div>
          <script>window.nodesData = ${JSON.stringify(root)};</script>
          <script charset="UTF-8">
            ${jsString}
          </script>
      `;
      fs.writeFileSync(filename, html);
    }
  };
};

function getDeepMoreThenOneChild(tree) {
  if (tree.children && tree.children.length === 1) {
    return getDeepMoreThenOneChild(tree.children[0]);
  }
  return tree;
}
  // if root children have only on child we can flatten this
function flattenTree(root) {
  let newChildren = [];
  root.children.forEach((child) => {
    let commonParent = getDeepMoreThenOneChild(child);
    newChildren = newChildren.concat(commonParent.children);
  });
  root.children = newChildren;
}


function addToPath(tree, p, value) {
  if (p[0] === '') {
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

function getBytesPerFileUsingSourceMap(rendered) {

  let map = new SourceMapConsumer(rendered.map);
  let lines = rendered.code.split(/[\r\n]/);

  let bytesPerFile = {};

  // For every byte in the minified code, do a sourcemap lookup.
  for (let line = 0; line < lines.length; line++) {
    for (let col = 0; col < lines[line].length; col++) {
      let result = map.originalPositionFor({ line: line + 1, column: col });
      let source = result.source || 'root';
      if (!bytesPerFile[source]) {
        bytesPerFile[source] = 0;
      }
      bytesPerFile[source]++;
    }
  }
  return Object.keys(bytesPerFile).map(file =>
      ({ file: path.resolve(file), bytes: bytesPerFile[file] }));
}



// Given a file C:/path/to/file/on/filesystem.js
// - remove extension
// - strip filesystem root
// - return path segments, starting from the tail and working backwards
// segments('C:/path/to/file/on/filesystem.js') === ['filesystem', 'on', 'file', 'to', 'path']
function segments(filepath) {
  let parsed = path.parse(filepath);
  let dirWithoutRoot = parsed.dir.substring(parsed.root.length);

  return dirWithoutRoot.split(path.sep).concat(parsed.name).reverse();
}

// Adds a .minifiedSize property to each module in the bundle (using sourcemap data)
// If the minified size could not be computed, no property is added.
// Module id are mapped to sources by finding the best match.
// Matching is done by removing the file extensions and comparing path segments
function addMinifiedSizesToModules(bundle, rendered) {
  let fileSizes = getBytesPerFileUsingSourceMap(rendered);

  const findBestMatchingModule = filename => {
    let filenameSegments = segments(filename);

    for (let i = 1; i <= filenameSegments.length; i++) {
      let leftVals = filenameSegments.slice(0, i);

      let matches = bundle.modules.filter(module => {
        let moduleSegments = segments(module.id);
        let rightVals = moduleSegments.slice(0, i);
        if (rightVals.length !== leftVals.length) {
          return false;
        }
        return rightVals.every((rightVal, i) => rightVal === leftVals[i]);
      });

      if (matches.length === 1) {
        return matches[0];
      }
    }

    return null;
  };

  fileSizes.forEach(tuple => {
    let module = findBestMatchingModule(tuple.file);
    if (module) {module.minifiedSize = tuple.bytes;}
  });
}
