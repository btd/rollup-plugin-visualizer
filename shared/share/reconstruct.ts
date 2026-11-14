import type { ModuleMeta, ModuleTree, ModuleTreeLeaf, VisualizerData } from "../types.js";
import { boolState, budget, invalid, putBool, ShareError, type ShareLimits } from "./limits.js";
import { reference } from "./binary.js";
import { treeEqual } from "./validation.js";

export interface TreeRecipe {
  rootName: string;
  rootState: number;
  names: string[];
  kinds: number[];
  parts: number[];
}

export const deriveTree = (
  data: VisualizerData,
  recipe: TreeRecipe,
  limits: ShareLimits,
): ModuleTree => {
  const partRows = Object.entries(data.nodeParts);
  const encoder = new TextEncoder();
  const paths = new Map<string, string[]>(),
    textLengths = new Map<string, number>();
  let textBytes = 0;
  const textLength = (value: string): number => {
    let length = textLengths.get(value);
    if (length === undefined) {
      budget(value.length, limits.maxTextBytes, "Derived tree text");
      length = encoder.encode(value).length;
      textLengths.set(value, length);
    }
    return length;
  };
  const accountText = (bytes: number): void => {
    textBytes += bytes;
    budget(textBytes, limits.maxTextBytes, "Derived tree text");
  };
  accountText(textLength(recipe.rootName));
  const children: Array<ModuleTree | ModuleTreeLeaf> = [];
  const groups = new Map<string, ModuleTree[]>();
  const folders = new WeakMap<ModuleTree, Map<string, ModuleTree>>();
  let leaf = 0,
    nodes = 1 + recipe.names.length;
  budget(nodes, limits.maxRecords, "Derived tree nodes");
  recipe.names.forEach((name, i) => {
    accountText(textLength(name));
    if (recipe.kinds[i] === 1)
      children.push({ name, uid: reference(partRows, recipe.parts[leaf++])[0] });
    else if (recipe.kinds[i] === 0) {
      const tree: ModuleTree = { name, children: [] };
      children.push(tree);
      const sameName = groups.get(name) ?? [];
      sameName.push(tree);
      groups.set(name, sameName);
    } else invalid("Unknown derived bundle kind.");
  });
  if (leaf !== recipe.parts.length) invalid("Inconsistent direct-leaf count.");
  const memberships = new Map<string, string[]>();
  for (const meta of Object.values(data.nodeMetas))
    for (const [bundle, uid] of Object.entries(meta.moduleParts)) {
      const list = memberships.get(uid) ?? [];
      list.push(bundle);
      memberships.set(uid, list);
    }
  for (const [uid, part] of partRows) {
    const id = data.nodeMetas[part.metaUid].id;
    for (const bundle of memberships.get(uid) ?? []) {
      const bundleTrees = groups.get(bundle);
      if (!bundleTrees) continue;
      let path = paths.get(id);
      if (!path) {
        path = [];
        for (const match of id.matchAll(/[^\\/]+/g)) {
          path.push(match[0]);
          budget(path.length + 1, limits.maxTreeDepth, "Derived path depth");
        }
        paths.set(id, path);
      }
      if (!path.length) invalid("Cannot reconstruct an empty module path.");
      for (let tree of bundleTrees) {
        for (let i = 0; i < path.length - 1; i++) {
          let index = folders.get(tree);
          if (!index) {
            index = new Map();
            folders.set(tree, index);
          }
          let folder = index.get(path[i]);
          if (!folder) {
            budget(++nodes, limits.maxRecords, "Derived tree nodes");
            accountText(textLength(path[i]));
            folder = { name: path[i], children: [] };
            index.set(path[i], folder);
            tree.children.push(folder);
          }
          tree = folder;
        }
        budget(++nodes, limits.maxRecords, "Derived tree nodes");
        accountText(textLength(path[path.length - 1]));
        tree.children.push({ name: path[path.length - 1], uid });
      }
    }
  }
  const merge = (node: ModuleTree): ModuleTree | ModuleTreeLeaf => {
    while (node.children.length === 1) {
      const child = node.children[0],
        bytes = textLength(node.name) + 1 + textLength(child.name);
      accountText(bytes);
      const name = `${node.name}/${child.name}`;
      textLengths.set(name, bytes);
      if (!("children" in child)) return { name, uid: child.uid };
      node = { name, children: child.children };
    }
    node.children = node.children.map((child) => ("children" in child ? merge(child) : child));
    return node;
  };
  for (const child of children)
    if ("children" in child)
      child.children = child.children.map((node) => ("children" in node ? merge(node) : node));
  const root: ModuleTree = { name: recipe.rootName, children };
  putBool(root, "isRoot", recipe.rootState);
  return root;
};

export const treeRecipe = (data: VisualizerData, limits: ShareLimits): TreeRecipe | undefined => {
  const parts = new Map(Object.keys(data.nodeParts).map((uid, i) => [uid, i]));
  const recipe: TreeRecipe = {
    rootName: data.tree.name,
    rootState: boolState(data.tree, "isRoot"),
    names: [],
    kinds: [],
    parts: [],
  };
  for (const child of data.tree.children) {
    recipe.names.push(child.name);
    recipe.kinds.push("children" in child ? 0 : 1);
    if ("uid" in child) recipe.parts.push(parts.get(child.uid)!);
  }
  try {
    if (treeEqual(deriveTree(data, recipe, limits), data.tree)) return recipe;
  } catch (error) {
    if (!(error instanceof ShareError)) throw error;
  }
  return undefined;
};

export const incomingOrder = (metas: readonly [string, ModuleMeta][]): number[] | undefined => {
  const indices = new Map(metas.map(([uid], i) => [uid, i]));
  const successors = new Map<number, Set<number>>(),
    indegree = new Uint32Array(metas.length);
  for (const [, meta] of metas) {
    if (meta.importedBy.some((link) => boolState(link, "dynamic") !== 0)) return undefined;
    for (let i = 1; i < meta.importedBy.length; i++) {
      const a = indices.get(meta.importedBy[i - 1].uid)!,
        b = indices.get(meta.importedBy[i].uid)!;
      if (a === b) return undefined;
      const next = successors.get(a) ?? new Set<number>();
      if (!next.has(b)) {
        next.add(b);
        indegree[b]++;
        successors.set(a, next);
      }
    }
  }
  const order: number[] = [];
  for (let i = 0; i < metas.length; i++) if (!indegree[i]) order.push(i);
  for (let i = 0; i < order.length; i++)
    for (const next of successors.get(order[i]) ?? []) if (--indegree[next] === 0) order.push(next);
  if (order.length !== metas.length) return undefined;
  const incoming = metas.map(() => [] as number[]);
  for (const source of order) {
    const seen = new Set<number>();
    for (const link of metas[source][1].imported) {
      const target = indices.get(link.uid)!;
      if (!seen.has(target)) {
        seen.add(target);
        incoming[target].push(source);
      }
    }
  }
  if (
    metas.some(
      ([, meta], i) =>
        meta.importedBy.length !== incoming[i].length ||
        meta.importedBy.some((link, j) => indices.get(link.uid) !== incoming[i][j]),
    )
  )
    return undefined;
  return order;
};
