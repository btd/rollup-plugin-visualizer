import { GetModuleInfo } from "rollup";
import { isModuleTree, ModuleLink, ModuleRenderInfo, ModuleTree, ModuleTreeLeaf, ModuleUID } from "../types/types";
import { ModuleMapper } from "./module-mapper";

interface MappedNode {
  uid: string;
}

const addToPath = (id: string, tree: ModuleTree, modulePath: string[], node: MappedNode): void => {
  if (modulePath.length === 0) {
    throw new Error(`Error adding node to path ${id}`);
  }

  const [head, ...rest] = modulePath;

  if (rest.length === 0) {
    tree.children.push({ ...node, name: head });
    return;
  } else {
    let newTree = tree.children.find((folder): folder is ModuleTree => folder.name === head && isModuleTree(folder));

    if (!newTree) {
      newTree = { name: head, children: [] };
      tree.children.push(newTree);
    }
    addToPath(id, newTree, rest, node);
    return;
  }
};

export const getLocalId = (projectRoot: string | RegExp, moduleId: string): string => {
  return moduleId.replace(projectRoot, "");
};

export const buildTree = (
  projectRoot: string | RegExp,
  modules: Array<ModuleRenderInfo>,
  mapper: ModuleMapper
): ModuleTree => {
  const tree: ModuleTree = {
    name: "root",
    children: [],
  };

  for (const { id, renderedLength, gzipLength, brotliLength } of modules) {
    const localId = getLocalId(projectRoot, id);
    const mod = { id: localId, renderedLength, gzipLength, brotliLength };

    const uid = mapper.setValueByModuleId(localId, mod);

    const nodeData = { uid };

    const pathParts = localId.split(/\\|\//).filter((p) => p !== "");
    addToPath(localId, tree, pathParts, nodeData);
  }

  return tree;
};

export const mergeTrees = (trees: Array<ModuleTree | ModuleTreeLeaf>): ModuleTree => {
  const newTree = {
    name: "root",
    children: trees,
    isRoot: true,
  };

  return newTree;
};

export const addLinks = (
  projectRoot: string | RegExp,
  startModuleId: string,
  getModuleInfo: GetModuleInfo,
  links: ModuleLink[],
  mapper: ModuleMapper
): void => {
  const processedNodes: Record<ModuleUID, boolean> = {};

  const moduleIds = [startModuleId];

  while (moduleIds.length > 0) {
    const moduleId = moduleIds.shift() as string;
    const localId = getLocalId(projectRoot, moduleId);

    const moduleUid = mapper.getUid(localId);

    if (processedNodes[moduleUid]) {
      continue;
    } else {
      processedNodes[moduleUid] = true;
    }

    const mod = mapper.getValue(moduleUid, { id: localId, renderedLength: 0 });

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
      const localId = getLocalId(projectRoot, importedId);
      const importedUid = mapper.getUid(localId);
      links.push({ source: moduleUid, target: importedUid });
      moduleIds.push(importedId);
    }
    for (const importedId of moduleInfo.dynamicallyImportedIds) {
      const localId = getLocalId(projectRoot, importedId);
      const importedUid = mapper.getUid(localId);
      links.push({ source: moduleUid, target: importedUid, dynamic: true });
      moduleIds.push(importedId);
    }
  }
};
