"use strict";

const NODE_MODULES = /.*(?:\/|\\\\)?node_modules(?:\/|\\\\)([^/\\]+)(?:\/|\\\\).+/;

const buildGraph = (startModuleId, getModuleInfo, getInitialModuleData) => {
  const nodes = {};
  const links = [];

  const moduleIds = [startModuleId];

  let commonPrefix = startModuleId;

  let groupId = 0;
  const groups = {};

  while (moduleIds.length > 0) {
    const moduleId = moduleIds.shift();
    if (nodes[moduleId]) {
      continue;
    }

    //TODO maybe work with arrays?
    for (let i = 0; i < commonPrefix.length && i < moduleId.length; i++) {
      if (commonPrefix[i] !== moduleId[i]) {
        commonPrefix = commonPrefix.slice(0, i);
        break;
      }
    }

    const { id, importedIds } = getModuleInfo(moduleId);
    const modData = getInitialModuleData(id);

    nodes[id] = modData;
    for (const importedId of importedIds) {
      links.push({ source: moduleId, target: importedId });
      moduleIds.push(importedId);
    }
  }

  const commonPrefixLength = commonPrefix.length;

  //reprocess all the data to remove common prefix and add basic groups
  for (const [id, mod] of Object.entries(nodes)) {
    const newId = id.slice(commonPrefixLength);
    delete nodes[id];
    nodes[newId] = mod;

    let group = 0;
    const match = newId.match(NODE_MODULES);
    if (match) {
      const moduleName = match[1];
      if (groups[moduleName] != null) {
        group = groups[moduleName];
      } else {
        group = ++groupId;
        groups[moduleName] = group;
      }
    }

    mod.group = group;
  }

  for (const link of links) {
    const { source, target } = link;
    link.source = source.slice(commonPrefixLength);
    link.target = target.slice(commonPrefixLength);
  }

  const start = startModuleId.slice(commonPrefixLength);

  return { start, links, nodes, groups, commonPrefix };
};

const mergeGraphs = (id, graphs) => {
  let groupId = 0;
  const newGroups = {};

  const firstGraph = graphs[0].root;

  let commonCommonPrefix = firstGraph.commonPrefix;

  const reMapGroups = new Map();

  for (const { root } of graphs) {
    const { groups, commonPrefix } = root;
    const reMappedGroups = { "0": 0 };

    for (const [moduleName, prevGroupId] of Object.entries(groups)) {
      if (newGroups[moduleName] == null) {
        newGroups[moduleName] = ++groupId;
      }

      reMappedGroups[prevGroupId] = newGroups[moduleName];
    }

    for (let i = 0; i < commonCommonPrefix.length && i < commonPrefix.length; i++) {
      if (commonCommonPrefix[i] !== commonPrefix[i]) {
        commonCommonPrefix = commonCommonPrefix.slice(0, i);
        break;
      }
    }

    reMapGroups.set(root, reMappedGroups);
  }

  const newLinks = [];
  const newNodes = {};

  for (const { root } of graphs) {
    const { links, nodes, commonPrefix } = root;
    const notCommonPrefix = commonPrefix.slice(commonCommonPrefix.length);

    const reMappedGroups = reMapGroups.get(root);
    for (const [id, mod] of Object.entries(nodes)) {
      newNodes[notCommonPrefix + id] = mod;
      mod.group = reMappedGroups[mod.group];
    }

    for (const { source, target } of links) {
      newLinks.push({ source: notCommonPrefix + source, target: notCommonPrefix + target });
    }
  }

  const notCommonPrefix = firstGraph.commonPrefix.slice(commonCommonPrefix.length);
  const newStart = notCommonPrefix + firstGraph.start;

  return {
    id,
    root: {
      groups: newGroups,
      nodes: newNodes,
      links: newLinks,
      start: newStart,
      commonPrefix: commonCommonPrefix
    }
  };
};

module.exports = { buildGraph, mergeGraphs };
