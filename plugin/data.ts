import path from "path";
import { GetModuleInfo } from "rollup";
import {
  isModuleTree,
  ModuleLink,
  ModuleRenderInfo,
  ModuleTree,
  ModuleUID,
} from "../types/types";
import { ModuleMapper } from "./module-mapper";

const PLUGIN_PREFIX = "\u0000";

interface MappedNode {
  uid: string;
}

const addToPath = (
  tree: ModuleTree,
  modulePath: string[],
  node: MappedNode
): void => {
  if (modulePath.length === 0) {
    throw new Error(`Error adding node to path ${modulePath}`);
  }

  const [head, ...rest] = modulePath;

  if (rest.length === 0) {
    tree.children.push({ ...node, name: head });
    return;
  } else {
    let newTree = tree.children.find(
      (folder): folder is ModuleTree =>
        folder.name === head && isModuleTree(folder)
    );

    if (!newTree) {
      newTree = { name: head, children: [] };
      tree.children.push(newTree);
    }
    addToPath(newTree, rest, node);
    return;
  }
};

export const buildTree = (
  modules: Array<[string, ModuleRenderInfo]>,
  mapper: ModuleMapper
): ModuleTree => {
  let tree: ModuleTree = {
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
      const pathParts = name.split(path.sep);
      pathParts.shift(); // remove '' or C:
      addToPath(tree, pathParts, nodeData);
    }
  }

  tree = flattenTree(tree);

  return tree;
};

// if root children have only on child we can flatten this
export const flattenTree = (root: ModuleTree): ModuleTree => {
  const pluginChildren = [];
  const otherChildren = [];
  for (const child of root.children) {
    if (child?.name.startsWith(PLUGIN_PREFIX)) {
      pluginChildren.push(child);
    } else {
      otherChildren.push(child);
    }
  }

  let newRoot = root;
  if (otherChildren.length === 1 && isModuleTree(otherChildren[0])) {
    newRoot = otherChildren[0];
  }

  while (newRoot.children.length === 1 && isModuleTree(newRoot.children[0])) {
    newRoot = newRoot.children[0];
  }
  newRoot.children = newRoot.children.concat(pluginChildren);
  return newRoot;
};

export const mergeTrees = (trees: ModuleTree[]): ModuleTree => {
  if (trees.length === 1) {
    return trees[0];
  }
  const newTree = {
    name: "root",
    children: trees,
  };

  return newTree;
};

export const addLinks = (
  startModuleId: string,
  getModuleInfo: GetModuleInfo,
  links: ModuleLink[],
  mapper: ModuleMapper
): void => {
  const processedNodes: Record<ModuleUID, boolean> = {};

  const moduleIds = [startModuleId];

  while (moduleIds.length > 0) {
    const moduleId = moduleIds.shift() as string;

    const moduleUid = mapper.getUid(moduleId);

    if (processedNodes[moduleUid]) {
      continue;
    } else {
      processedNodes[moduleUid] = true;
    }

    const mod = mapper.getValue(moduleUid, { renderedLength: 0 });

    const moduleInfo = getModuleInfo(moduleId);

    if (!moduleInfo) {
      return;
    }

    if (moduleInfo.isEntry) {
      mod.isEntry = true;
    }
    if (moduleInfo.isExternal) {
      mod.isExternal = true;
    }

    for (const importedId of moduleInfo.importedIds) {
      const importedUid = mapper.getUid(importedId);
      links.push({ source: moduleUid, target: importedUid });
      moduleIds.push(importedId);
    }
    for (const importedId of moduleInfo.dynamicallyImportedIds) {
      const importedUid = mapper.getUid(importedId);
      links.push({ source: moduleUid, target: importedUid, dynamic: true });
      moduleIds.push(importedId);
    }
  }
};

const skipModule = (id: string, node: ModuleRenderInfo): boolean =>
  id.startsWith(PLUGIN_PREFIX) || node.isExternal || !path.isAbsolute(id);

export const removeCommonPrefix = (
  nodes: ModuleMapper["nodes"],
  nodeIds: ModuleMapper["nodeIds"]
): void => {
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

  if (commonPrefix == null) {
    return;
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
