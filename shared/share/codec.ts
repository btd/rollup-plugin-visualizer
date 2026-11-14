import type {
  ModuleMeta,
  ModulePart,
  ModuleTree,
  ModuleTreeLeaf,
  VisualizerData,
} from "../types.js";
import { Reader, Writer, reference, sumCounts } from "./binary.js";
import {
  boolState,
  budget,
  invalid,
  own,
  putBool,
  resolveLimits,
  setOwn,
  uint,
  type ShareLimits,
} from "./limits.js";
import { deriveTree, incomingOrder, treeRecipe } from "./reconstruct.js";
import { parseJson, validateReport } from "./validation.js";

export interface ShareExtension {
  id: number;
  payload: Uint8Array;
}
export interface ShareReport {
  title: string;
  data: VisualizerData;
  extensions: ShareExtension[];
}
export interface ShareReportInput {
  title?: string;
  data: unknown;
  extensions?: readonly ShareExtension[];
}

const utf8 = new TextEncoder();
const index = (values: readonly string[]) => new Map(values.map((value, i) => [value, i]));
const decomposeUid = (uid: string): [string, number | null] => {
  const match = /^([\s\S]*-)(0|[1-9][0-9]*)$/.exec(uid);
  return match && Number.isSafeInteger(Number(match[2]))
    ? [match[1], Number(match[2])]
    : [uid, null];
};

const flatten = (root: ModuleTree): Array<ModuleTree | ModuleTreeLeaf> => {
  const nodes: Array<ModuleTree | ModuleTreeLeaf> = [],
    stack: Array<ModuleTree | ModuleTreeLeaf> = [root];
  while (stack.length) {
    const node = stack.pop()!;
    nodes.push(node);
    if ("children" in node)
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
  }
  return nodes;
};

const writeUids = (writer: Writer, uids: readonly string[]): void => {
  const prefixes: string[] = [],
    prefixIndices = new Map<string, number>(),
    last = new Map<string, number>();
  const kinds: number[] = [],
    numbers: number[] = [];
  for (const uid of uids) {
    const [prefix, number] = decomposeUid(uid);
    if (!prefixIndices.has(prefix)) {
      prefixIndices.set(prefix, prefixes.length);
      prefixes.push(prefix);
    }
    kinds.push(prefixIndices.get(prefix)! * 2 + (number === null ? 0 : 1));
    numbers.push(number === null ? 0 : number - (last.get(prefix) ?? 0));
    if (number !== null) {
      writer.accountText(utf8.encode(prefix).length + String(number).length);
      last.set(prefix, number);
    }
  }
  writer.uint(prefixes.length);
  for (const prefix of prefixes) writer.text(prefix);
  writer.vector(kinds);
  writer.vector(numbers);
};

const readUids = (reader: Reader): string[] => {
  const prefixCount = reader.count(reader.limits.maxEntries),
    prefixes: string[] = [];
  for (let i = 0; i < prefixCount; i++) prefixes.push(reader.text());
  const kinds = reader.vector(),
    numbers = reader.vector(kinds.length),
    last = new Map<string, number>();
  const uids = kinds.map((kind, i) => {
    const prefix = reference(prefixes, Math.floor(kind / 2));
    if (!(kind % 2)) {
      if (numbers[i] !== 0) invalid("Literal UID has a numeric suffix.");
      return prefix;
    }
    const number = uint((last.get(prefix) ?? 0) + numbers[i]);
    last.set(prefix, number);
    const suffix = String(number);
    reader.accountText(utf8.encode(prefix).length + suffix.length);
    return prefix + suffix;
  });
  if (new Set(uids).size !== uids.length) invalid("Duplicate UID table entries.");
  return uids;
};

const writeStrings = (writer: Writer, strings: readonly string[]): void => {
  const lengths: number[] = [],
    suffixes: string[] = [];
  let previous = "";
  for (const value of strings) {
    let prefix = 0,
      offset = 0,
      prefixBytes = 0;
    while (
      offset < previous.length &&
      offset < value.length &&
      previous.codePointAt(offset) === value.codePointAt(offset)
    ) {
      const point = value.codePointAt(offset)!;
      prefixBytes += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
      offset += point > 65535 ? 2 : 1;
      prefix++;
    }
    writer.accountText(prefixBytes);
    lengths.push(prefix);
    suffixes.push(value.slice(offset));
    previous = value;
  }
  writer.uint(strings.length);
  writer.vector(lengths);
  for (const suffix of suffixes) writer.text(suffix);
};

const readStrings = (reader: Reader): string[] => {
  const count = reader.count(reader.limits.maxEntries),
    prefixes = reader.vector(count),
    strings: string[] = [];
  let previous = "";
  for (let i = 0; i < count; i++) {
    const suffix = reader.text();
    let offset = 0,
      prefixBytes = 0;
    for (let j = 0; j < prefixes[i]; j++) {
      if (offset >= previous.length) invalid("Invalid Unicode string prefix.");
      const point = previous.codePointAt(offset)!;
      offset += point > 65535 ? 2 : 1;
      prefixBytes += point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
    }
    reader.accountText(prefixBytes);
    previous = previous.slice(0, offset) + suffix;
    strings.push(previous);
  }
  return strings;
};

const uniqueRows = (uids: readonly string[]): void => {
  if (new Set(uids).size !== uids.length) invalid("Duplicate report record UID.");
};

export const encodeReport = (
  input: ShareReportInput,
  overrides: Partial<ShareLimits> = {},
): Uint8Array => {
  const limits = resolveLimits(overrides),
    data = validateReport(input.data, limits),
    writer = new Writer(limits);
  const title = input.title ?? "Rollup Visualizer";
  if (typeof title !== "string") return invalid("Invalid report title.");
  const metas = Object.entries(data.nodeMetas),
    parts = Object.entries(data.nodeParts);
  const moduleRows = index(metas.map(([uid]) => uid)),
    partRows = index(parts.map(([uid]) => uid));
  const recipe = treeRecipe(data, limits),
    tree = recipe ? [] : flatten(data.tree);
  const strings = [
    ...new Set([
      ...metas.map(([, meta]) => meta.id),
      ...metas.flatMap(([, meta]) => Object.keys(meta.moduleParts)),
      ...(recipe ? [recipe.rootName, ...recipe.names] : tree.map((node) => node.name)),
    ]),
  ].toSorted();
  budget(strings.length, limits.maxEntries, "String count");
  const stringRows = index(strings);
  const uids = [...new Set([...moduleRows.keys(), ...partRows.keys()])].toSorted((a, b) => {
    const [ap, an] = decomposeUid(a),
      [bp, bn] = decomposeUid(b);
    if (ap !== bp) return ap < bp ? -1 : 1;
    if (an === null || bn === null) return an === bn ? 0 : an === null ? -1 : 1;
    return an - bn;
  });
  const uidRows = index(uids);
  writer.text(title);
  writer.uint(
    Number(data.options.gzip) +
      2 * Number(data.options.brotli) +
      4 * Number(data.options.sourcemap),
  );
  writer.text(JSON.stringify(data.env));
  writeStrings(writer, strings);
  writeUids(writer, uids);
  writer.vector(
    metas.map(([uid]) => uidRows.get(uid)!),
    true,
  );
  writer.vector(
    metas.map(([, meta]) => stringRows.get(meta.id)!),
    true,
  );
  writer.vector(
    metas.map(([, meta]) => boolState(meta, "isEntry") + 4 * boolState(meta, "isExternal")),
  );
  writer.vector(metas.map(([, meta]) => Object.keys(meta.moduleParts).length));
  const memberships = metas.flatMap(([, meta]) => Object.entries(meta.moduleParts));
  writer.vector(memberships.map(([bundle]) => stringRows.get(bundle)!));
  writer.vector(
    memberships.map(([, uid]) => partRows.get(uid)!),
    true,
  );
  writer.vector(
    parts.map(([uid]) => uidRows.get(uid)!),
    true,
  );
  writer.vector(
    parts.map(([, part]) => moduleRows.get(part.metaUid)!),
    true,
  );
  for (const size of ["renderedLength", "gzipLength", "brotliLength"] as const)
    writer.vector(parts.map(([, part]) => part[size]));
  const links = (name: "imported" | "importedBy") => {
    writer.vector(metas.map(([, meta]) => meta[name].length));
    const values = metas.flatMap(([, meta]) => meta[name]);
    writer.vector(
      values.map((link) => moduleRows.get(link.uid)!),
      true,
    );
    writer.vector(values.map((link) => boolState(link, "dynamic")));
  };
  links("imported");
  const order = incomingOrder(metas);
  writer.uint(order === undefined ? 0 : 1);
  if (order === undefined) links("importedBy");
  else writer.vector(order, true);
  writer.uint(recipe ? 1 : 0);
  if (recipe) {
    writer.uint(stringRows.get(recipe.rootName)!);
    writer.uint(recipe.rootState);
    writer.uint(recipe.names.length);
    writer.vector(recipe.names.map((name) => stringRows.get(name)!));
    writer.vector(recipe.kinds);
    writer.vector(recipe.parts, true);
  } else {
    writer.vector(tree.map((node) => stringRows.get(node.name)!));
    writer.vector(tree.map((node) => ("children" in node ? node.children.length + 1 : 0)));
    writer.vector(tree.map((node) => boolState(node, "isRoot")));
    writer.vector(
      tree.flatMap((node) => ("uid" in node ? [partRows.get(node.uid)!] : [])),
      true,
    );
  }
  const extensions = input.extensions ?? [];
  budget(extensions.length, limits.maxExtensions, "Extension count");
  writer.uint(extensions.length);
  const ids = new Set<number>();
  for (const extension of extensions) {
    const id = uint(extension.id);
    if (!id || ids.has(id) || !(extension.payload instanceof Uint8Array))
      invalid("Invalid or duplicate optional extension.");
    ids.add(id);
    writer.uint(id);
    writer.uint(extension.payload.length);
    writer.bytes(extension.payload);
  }
  return writer.finish();
};

const readTree = (
  reader: Reader,
  strings: readonly string[],
  partUids: readonly string[],
): ModuleTree => {
  const names = reader.vector(undefined, reader.limits.maxRecords),
    kinds = reader.vector(names.length),
    flags = reader.vector(names.length);
  if (!names.length || kinds[0] === 0) return invalid("Missing root tree branch.");
  const leafRefs = reader.vector(kinds.filter((kind) => kind === 0).length);
  let children = 0;
  for (const kind of kinds) {
    children += kind ? kind - 1 : 0;
    budget(children, names.length, "Tree child count");
  }
  if (children !== names.length - 1) return invalid("Inconsistent tree child totals.");
  const pending: Array<{ node: ModuleTree; left: number }> = [];
  let leaf = 0,
    root: ModuleTree | undefined;
  for (let i = 0; i < names.length; i++) {
    const name = reference(strings, names[i]);
    const node: ModuleTree | ModuleTreeLeaf = kinds[i]
      ? { name, children: [] }
      : { name, uid: reference(partUids, leafRefs[leaf++]) };
    putBool(node, "isRoot", flags[i]);
    if (i === 0) root = node as ModuleTree;
    else {
      while (pending.length && pending[pending.length - 1].left === 0) pending.pop();
      if (!pending.length) return invalid("Disconnected tree nodes.");
      const parent = pending[pending.length - 1];
      parent.node.children.push(node);
      parent.left--;
    }
    budget(pending.length, reader.limits.maxTreeDepth, "Tree depth");
    if ("children" in node) pending.push({ node, left: kinds[i] - 1 });
  }
  if (pending.some(({ left }) => left)) return invalid("Truncated tree structure.");
  return root!;
};

export const decodeReport = (
  bytes: Uint8Array,
  overrides: Partial<ShareLimits> = {},
): ShareReport => {
  const limits = resolveLimits(overrides),
    reader = new Reader(bytes, limits);
  const title = reader.text(),
    options = reader.uint();
  if (options > 7) invalid("Unknown report option bits.");
  const env = parseJson(reader.text(), limits.maxJsonDepth);
  const strings = readStrings(reader),
    uids = readUids(reader);
  const moduleUids = reader.vector(undefined, limits.maxRecords).map((i) => reference(uids, i));
  uniqueRows(moduleUids);
  const count = moduleUids.length,
    ids = reader.vector(count),
    flags = reader.vector(count),
    memberCounts = reader.vector(count);
  const memberTotal = sumCounts(memberCounts, limits),
    bundleRefs = reader.vector(memberTotal),
    partRefs = reader.vector(memberTotal);
  const partUids = reader.vector(undefined, limits.maxRecords).map((i) => reference(uids, i));
  uniqueRows(partUids);
  const partCount = partUids.length,
    owners = reader.vector(partCount),
    rendered = reader.vector(partCount),
    gzip = reader.vector(partCount),
    brotli = reader.vector(partCount);
  const metas: ModuleMeta[] = moduleUids.map((_, i) => {
    const meta: ModuleMeta = {
      id: reference(strings, ids[i]),
      moduleParts: {},
      imported: [],
      importedBy: [],
    };
    if (flags[i] >= 16) invalid("Unknown module flags.");
    putBool(meta, "isEntry", flags[i] % 4);
    putBool(meta, "isExternal", Math.floor(flags[i] / 4));
    return meta;
  });
  let member = 0;
  metas.forEach((meta, i) => {
    for (let j = 0; j < memberCounts[i]; j++, member++) {
      const bundle = reference(strings, bundleRefs[member]);
      if (own(meta.moduleParts, bundle)) invalid("Duplicate bundle membership.");
      setOwn(meta.moduleParts, bundle, reference(partUids, partRefs[member]));
    }
  });
  const nodeMetas: Record<string, ModuleMeta> = {},
    nodeParts: Record<string, ModulePart> = {};
  metas.forEach((meta, i) => setOwn(nodeMetas, moduleUids[i], meta));
  partUids.forEach((uid, i) =>
    setOwn(nodeParts, uid, {
      metaUid: reference(moduleUids, owners[i]),
      renderedLength: rendered[i],
      gzipLength: gzip[i],
      brotliLength: brotli[i],
    }),
  );
  let edgeTotal = 0;
  const readLinks = (name: "imported" | "importedBy") => {
    const counts = reader.vector(count),
      total = sumCounts(counts, limits);
    edgeTotal += total;
    budget(edgeTotal, limits.maxEntries, "Dependency entries");
    const refs = reader.vector(total),
      states = reader.vector(total);
    let position = 0;
    metas.forEach((meta, i) => {
      for (let j = 0; j < counts[i]; j++, position++) {
        const link = { uid: reference(moduleUids, refs[position]) };
        putBool(link, "dynamic", states[position]);
        meta[name].push(link);
      }
    });
  };
  readLinks("imported");
  const mode = reader.uint();
  if (mode === 0) readLinks("importedBy");
  else if (mode === 1) {
    const order = reader.vector(count),
      seen = new Uint8Array(count);
    for (const i of order) {
      const source = reference(metas, i);
      if (seen[i]) invalid("Duplicate source traversal row.");
      seen[i] = 1;
      const targets = new Set<string>();
      for (const link of source.imported)
        if (!targets.has(link.uid)) {
          targets.add(link.uid);
          budget(++edgeTotal, limits.maxEntries, "Dependency entries");
          nodeMetas[link.uid].importedBy.push({ uid: moduleUids[i] });
        }
    }
  } else invalid("Unknown incoming dependency mode.");
  const data: VisualizerData = {
    version: 2,
    tree: { name: "", children: [] },
    nodeMetas,
    nodeParts,
    env: env as VisualizerData["env"],
    options: { gzip: !!(options & 1), brotli: !!(options & 2), sourcemap: !!(options & 4) },
  };
  const treeMode = reader.uint();
  if (treeMode === 0) data.tree = readTree(reader, strings, partUids);
  else if (treeMode === 1) {
    const rootName = reader.ref(strings),
      rootState = reader.uint(),
      bundles = reader.count();
    const names = reader.vector(bundles).map((i) => reference(strings, i)),
      kinds = reader.vector(bundles);
    const parts = reader.vector(kinds.filter((kind) => kind === 1).length);
    data.tree = deriveTree(data, { rootName, rootState, names, kinds, parts }, limits);
  } else invalid("Unknown hierarchy mode.");
  const extensions: ShareExtension[] = [],
    extensionCount = reader.count(limits.maxExtensions),
    extensionIds = new Set<number>();
  for (let i = 0; i < extensionCount; i++) {
    const id = reader.uint();
    if (!id || extensionIds.has(id)) invalid("Invalid or duplicate optional extension.");
    extensionIds.add(id);
    extensions.push({ id, payload: reader.bytes(reader.uint()).slice() });
  }
  reader.end();
  validateReport(data, limits);
  // JS record enumeration has defined integer-key ordering; do not accept a wire order it cannot retain.
  if (
    Object.keys(nodeMetas).some((uid, i) => uid !== moduleUids[i]) ||
    Object.keys(nodeParts).some((uid, i) => uid !== partUids[i])
  )
    invalid("Noncanonical record iteration order.");
  return { title, data, extensions };
};
