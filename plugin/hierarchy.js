"use strict";

const path = require("path");

// prepare d3-hierarchy style tree from entry point modules

const PLUGIN_PREFIX = "\u0000";

const buildTree = (ids, getInitialModuleData, flatten = true) => {
  let root = {
    name: "root",
    children: []
  };

  for (const id of ids) {
    const name = id;
    const m = getInitialModuleData(id);

    if (m.size === 0) {
      continue;
    }

    if (name.startsWith(PLUGIN_PREFIX)) {
      addToPath(root, [name], m);
    } else {
      addToPath(root, name.split(path.sep), m);
    }
  }

  if (flatten) {
    root = flattenTree(root);
  }

  return root;
};

// if root children have only on child we can flatten this
const flattenTree = root => {
  let newRoot = root;
  while (newRoot.children && newRoot.children.length === 1) {
    newRoot = newRoot.children[0];
  }
  return newRoot;
};

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

const mergeTrees = (children, flatten = true) => {
  let root = {
    name: "root",
    children
  };

  if (flatten) {
    root = flattenTree(root);
  }

  return root;
};

module.exports = { buildTree, mergeTrees };
