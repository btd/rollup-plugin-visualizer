"use strict";

const path = require("path");

// prepare d3-hierarchy style tree from entry point modules

const PLUGIN_PREFIX = "\u0000";

const buildTree = (ids, getInitialModuleData, flatten = true) => {
  const root = {
    name: "root",
    children: []
  };

  for (const id of ids) {
    const name = id;
    const m = getInitialModuleData(id);

    if (name.indexOf(PLUGIN_PREFIX) === 0) {
      addToPath(root, [name], m);
    } else {
      addToPath(root, name.split(path.sep), m);
    }
  }

  if (flatten) {
    flattenTree(root);
  }

  return root;
};

const getDeepMoreThenOneChild = tree => {
  if (tree.children && tree.children.length === 1) {
    return getDeepMoreThenOneChild(tree.children[0]);
  }
  return tree;
};

// if root children have only on child we can flatten this
const flattenTree = root => {
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

module.exports = buildTree;
