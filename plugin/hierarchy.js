"use strict";

const path = require("path");

// prepare d3-hierarchy style tree from entry point modules

const PLUGIN_PREFIX = "\u0000";

let _counter = 0;
const UID = name => {
  return `${name}-${_counter++}`;
};

const buildTree = (name, ids, getInitialModuleData) => {
  let tree = {
    name: "root",
    children: []
  };

  const nodes = {};

  const nodeIds = {};

  for (const id of ids) {
    const name = id;
    const mod = getInitialModuleData(id);

    const uid = UID("node");
    nodes[uid] = mod;
    nodeIds[id] = uid;

    if (mod.size === 0) {
      continue;
    }

    const nodeData = { uid };

    if (name.startsWith(PLUGIN_PREFIX)) {
      addToPath(tree, [name], nodeData);
    } else {
      addToPath(tree, name.split(path.sep), nodeData);
    }
  }

  tree = flattenTree(tree);
  tree.name = name;

  return { tree, nodes, nodeIds };
};

// if root children have only on child we can flatten this
const flattenTree = root => {
  let newRoot = root;
  while (newRoot.children && newRoot.children.length === 1) {
    newRoot = newRoot.children[0];
  }
  return newRoot;
};

// ugly but works for now
function addToPath(tree, p, value) {
  if (p[0] === "") {
    p.shift();
  }

  let child = tree.children.find(c => c.name === p[0]);
  if (child == null) {
    child = {
      name: p[0],
      children: []
    };
    tree.children.push(child);
  }
  if (p.length === 1) {
    Object.assign(child, value);
    delete child.children;
    return;
  }
  p.shift();
  addToPath(child, p, value);
}

const mergeTrees = trees => {
  const newTree = {
    name: "root",
    children: trees.map(({ tree }) => tree)
  };

  const newNodes = {};
  const newNodeIds = {};
  for (const { nodes, nodeIds } of trees) {
    Object.assign(newNodes, nodes);
    Object.assign(newNodeIds, nodeIds);
  }

  return { tree: newTree, nodes: newNodes, nodeIds: newNodeIds };
};

module.exports = { buildTree, mergeTrees };
