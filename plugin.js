const fs = require('fs');
const path = require('path');

const cssString = fs.readFileSync(path.join(__dirname, 'lib', './style.css'), 'utf8');
const jsString = fs.readFileSync(path.join(__dirname, 'lib', './pluginmain.js'), 'utf8');

const COMMONJS_PLUGIN_PREFIX = '\u0000commonjs-proxy:';


module.exports = function(opts) {
  var filename = opts.filename || 'stats.html';

  return {
    ongenerate({ bundle }) {
      let root = {
        name: 'root',
        children: []
      };

      bundle.modules.forEach(module => {
        let name = module.id;
        let m = {
          //dependencies: module.dependencies,
          size: Buffer.byteLength(module.code, 'utf8'),
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
  if (tree.children.length === 1) {
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
