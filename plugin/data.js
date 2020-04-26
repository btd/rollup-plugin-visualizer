"use strict";

const path = require("path");

const PLUGIN_PREFIX = "\u0000";

const buildTree = (modules, mapper) => {
  let tree = {
    name: "root",
    children: [],
  };

  for (const [id, { renderedLength }] of modules) {
    const mod = { renderedLength };
    const name = id;

    const uid = mapper.setValueByModuleId(id, mod);

    const nodeData = { uid };

    if (name.startsWith(PLUGIN_PREFIX)) {
      addToPath(tree, [name], nodeData);
    } else {
      addToPath(tree, name.split(path.sep), nodeData);
    }
  }

  tree = flattenTree(tree);

  return tree;
};

// if root children have only on child we can flatten this
const flattenTree = (root) => {
  let newRoot = root;
  const pluginChildren = [];
  const otherChildren = [];
  for (const child of root.children || []) {
    if (child.name.startsWith(PLUGIN_PREFIX)) {
      pluginChildren.push(child);
    } else {
      otherChildren.push(child);
    }
  }

  if (otherChildren.length === 1 && otherChildren[0].children) {
    newRoot = otherChildren[0];
  }
  while (
    newRoot.children &&
    newRoot.children.length === 1 &&
    newRoot.children[0].children
  ) {
    newRoot = newRoot.children[0];
  }
  newRoot.children = newRoot.children.concat(pluginChildren);
  return newRoot;
};

// ugly but works for now
function addToPath(tree, p, value) {
  if (p[0] === "") {
    p.shift();
  }

  let child = tree.children.find((c) => c.name === p[0]);
  if (child == null) {
    child = {
      name: p[0],
      children: [],
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

const mergeTrees = (trees) => {
  if (trees.length === 1) {
    return trees[0];
  }
  const newTree = {
    name: "root",
    children: trees,
  };

  return newTree;
};

const addLinks = (startModuleId, getModuleInfo, links, mapper) => {
  const processedNodes = {};

  const moduleIds = [startModuleId];

  while (moduleIds.length > 0) {
    const moduleId = moduleIds.shift();

    const moduleUid = mapper.getUid(moduleId);

    if (processedNodes[moduleUid]) {
      continue;
    } else {
      processedNodes[moduleUid] = true;
    }

    const mod = mapper.getValue(moduleUid, { renderedLength: 0 });

    const info = getModuleInfo(moduleId);
    const {
      importedIds,
      isEntry,
      isExternal,
      dynamicallyImportedIds = [],
    } = info;

    if (isEntry) {
      mod.isEntry = true;
    }
    if (isExternal) {
      mod.isExternal = true;
    }

    for (const importedId of importedIds) {
      const importedUid = mapper.getUid(importedId);
      links.push({ source: moduleUid, target: importedUid });
      moduleIds.push(importedId);
    }
    for (const importedId of dynamicallyImportedIds) {
      const importedUid = mapper.getUid(importedId);
      links.push({ source: moduleUid, target: importedUid, dynamic: true });
      moduleIds.push(importedId);
    }
  }
};

const skipModule = (id, node) =>
  id.startsWith(PLUGIN_PREFIX) || node.isExternal || !path.isAbsolute(id);

const removeCommonPrefix = (nodes, nodeIds) => {
  let commonPrefix = null;

  for (const [id, uid] of Object.entries(nodeIds)) {
    const node = nodes[uid];

    if (!skipModule(id, node)) {
      if (commonPrefix == null) {
        commonPrefix = id;
      }

      for (let i = 0; i < commonPrefix.length && i < id.length; i++) {
        if (commonPrefix[i] !== id[i]) {
          commonPrefix = commonPrefix.slice(0, i);
          break;
        }
      }
    }
  }

  const commonPrefixLength = commonPrefix.length;
  for (const [id, uid] of Object.entries(nodeIds)) {
    const node = nodes[uid];
    if (!skipModule(id, node)) {
      const newId = id.slice(commonPrefixLength);
      const value = nodeIds[id];
      delete nodeIds[id];
      nodeIds[newId] = value;
    }
  }
};

module.exports = { buildTree, mergeTrees, addLinks, removeCommonPrefix };
