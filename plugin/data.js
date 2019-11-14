"use strict";

const path = require("path");

const PLUGIN_PREFIX = "\u0000";

const buildTree = (name, ids, getInitialModuleData, mapper) => {
  let tree = {
    name: "root",
    children: []
  };

  for (const id of ids) {
    const name = id;
    const mod = getInitialModuleData(id);

    const uid = mapper.setValueByModuleId(id, mod);

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

  return tree;
};

// if root children have only on child we can flatten this
const flattenTree = root => {
  let newRoot = root;
  while (newRoot.children) {
    if (newRoot.children.length === 1) {
      newRoot = newRoot.children[0];
    } else {
      const pluginChildren = [];
      const otherChildren = [];
      for (const child of newRoot.children) {
        if (child.name.startsWith(PLUGIN_PREFIX)) {
          pluginChildren.push(child);
        } else {
          otherChildren.push(child);
        }
      }
      if (otherChildren.length === 1) {
        newRoot = otherChildren[0];
        newRoot.children = newRoot.children.concat(pluginChildren);
      } else {
        break;
      }
    }
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
  if (trees.length === 1) {
    return trees[0];
  }
  const newTree = {
    name: "root",
    children: trees
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

    const mod = mapper.getValue(moduleUid, { size: 0 });

    const info = getModuleInfo(moduleId);
    const { importedIds, isEntry, isExternal } = info;

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
  }
};

const skipModule = (id, node) => id.startsWith(PLUGIN_PREFIX) || node.isExternal;

const removeCommonPrefix = (nodes, nodeIds) => {
  let commonPrefix = null;

  for (const [id, uid] of Object.entries(nodeIds)) {
    const node = nodes[uid];
    if (commonPrefix == null) {
      commonPrefix = id;
    }

    if (!skipModule(id, node)) {
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
