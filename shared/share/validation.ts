import type { ModuleTree, ModuleTreeLeaf, VisualizerData } from "../types.js";
import { budget, invalid, own, uint, resolveLimits, type ShareLimits } from "./limits.js";
import { wellFormed } from "./binary.js";

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid("Unsupported report object shape.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    return invalid("Unsupported report object shape.");
  return value as Record<string, unknown>;
};

const fields = (
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): void => {
  for (const key of required) if (!own(value, key)) invalid(`Missing report field: ${key}.`);
  for (const key of Object.keys(value))
    if (!required.includes(key) && !optional.includes(key))
      invalid(`Unsupported report field: ${key}.`);
};

const text = (value: unknown): string => {
  if (typeof value !== "string" || !wellFormed(value))
    return invalid("Expected well-formed Unicode report text.");
  return value;
};
const boolean = (value: unknown): void => {
  if (typeof value !== "boolean") invalid("Invalid report boolean.");
};
const optionalBoolean = (row: Record<string, unknown>, key: string): void => {
  if (own(row, key)) boolean(row[key]);
};

export const validateJsonValue = (value: unknown, limits: ShareLimits): void => {
  const active = new Set<object>();
  const stack: { value: unknown; depth: number; exit?: boolean }[] = [{ value, depth: 0 }];
  let entries = 0;
  while (stack.length) {
    const { value: current, depth, exit } = stack.pop()!;
    if (exit && current && typeof current === "object") {
      active.delete(current);
      continue;
    }
    budget(depth, limits.maxJsonDepth, "JSON depth");
    budget(++entries, limits.maxEntries, "JSON entries");
    if (current === null || typeof current === "boolean" || typeof current === "string") continue;
    if (typeof current === "number" && Number.isFinite(current)) continue;
    if (typeof current !== "object" || current === null)
      return invalid("Environment must contain JSON values.");
    if (active.has(current)) return invalid("Environment must not contain cycles.");
    active.add(current);
    stack.push({ value: current, depth, exit: true });
    const children = Array.isArray(current) ? current : Object.values(object(current));
    for (const child of children) stack.push({ value: child, depth: depth + 1 });
  }
};

export const parseJson = (source: string, maxDepth: number): unknown => {
  let depth = 0,
    quoted = false,
    escaped = false;
  for (const char of source) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{" || char === "[") budget(++depth - 1, maxDepth, "JSON depth");
    else if (char === "}" || char === "]") depth--;
  }
  try {
    return JSON.parse(source);
  } catch {
    return invalid("Invalid report JSON.");
  }
};

export const validateReport = (input: unknown, limits: ShareLimits): VisualizerData => {
  const textLengths = new Map<string, number>();
  const encoder = new TextEncoder();
  let textBytes = 0;
  const reportText = (value: unknown): string => {
    if (typeof value !== "string") return invalid("Expected Unicode report text.");
    let length = textLengths.get(value);
    if (length === undefined) {
      budget(value.length, limits.maxTextBytes, "Report text");
      text(value);
      length = encoder.encode(value).length;
      textLengths.set(value, length);
    }
    textBytes += length;
    budget(textBytes, limits.maxTextBytes, "Report text");
    return value;
  };
  const data = object(input);
  fields(data, ["version", "tree", "nodeParts", "nodeMetas", "env", "options"]);
  if (data.version !== 2)
    return invalid("Unsupported raw-data report version or shape. Generate current raw-data JSON.");
  const options = object(data.options);
  fields(options, ["gzip", "brotli", "sourcemap"]);
  for (const value of Object.values(options)) boolean(value);
  const env = object(data.env);
  validateJsonValue(env, limits);
  const metas = object(data.nodeMetas),
    parts = object(data.nodeParts);
  budget(Object.keys(metas).length, limits.maxRecords, "Module count");
  budget(Object.keys(parts).length, limits.maxRecords, "Part count");
  let memberships = 0,
    edges = 0;
  for (const [uid, value] of Object.entries(metas)) {
    reportText(uid);
    const meta = object(value);
    fields(meta, ["id", "moduleParts", "imported", "importedBy"], ["isEntry", "isExternal"]);
    reportText(meta.id);
    optionalBoolean(meta, "isEntry");
    optionalBoolean(meta, "isExternal");
    for (const [bundle, partUid] of Object.entries(object(meta.moduleParts))) {
      reportText(bundle);
      reportText(partUid);
      budget(++memberships, limits.maxEntries, "Membership count");
      if (!own(parts, partUid as string) || object(parts[partUid as string]).metaUid !== uid)
        invalid("Invalid module/part owner reference.");
    }
    for (const name of ["imported", "importedBy"]) {
      const links = meta[name];
      if (!Array.isArray(links)) return invalid("Invalid dependency list.");
      edges += links.length;
      budget(edges, limits.maxEntries, "Dependency entries");
      for (const item of links) {
        const link = object(item);
        fields(link, ["uid"], ["dynamic"]);
        reportText(link.uid);
        optionalBoolean(link, "dynamic");
        if (!own(metas, link.uid as string)) invalid("Invalid dependency reference.");
      }
    }
  }
  for (const [uid, value] of Object.entries(parts)) {
    reportText(uid);
    const part = object(value);
    fields(part, ["metaUid", "renderedLength", "gzipLength", "brotliLength"]);
    reportText(part.metaUid);
    if (!own(metas, part.metaUid as string)) invalid("Invalid part owner reference.");
    uint(part.renderedLength);
    uint(part.gzipLength);
    uint(part.brotliLength);
  }
  const seen = new Set<object>(),
    stack = [{ node: data.tree, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    budget(++nodes, limits.maxRecords, "Tree node count");
    budget(depth, limits.maxTreeDepth, "Tree depth");
    const row = object(node);
    if (seen.has(row)) invalid("Tree contains repeated or cyclic nodes.");
    seen.add(row);
    reportText(row.name);
    optionalBoolean(row, "isRoot");
    if (own(row, "children")) {
      fields(row, ["name", "children"], ["isRoot"]);
      if (!Array.isArray(row.children)) return invalid("Invalid tree children.");
      budget(nodes + stack.length + row.children.length, limits.maxRecords, "Tree node count");
      for (let i = row.children.length - 1; i >= 0; i--)
        stack.push({ node: row.children[i], depth: depth + 1 });
    } else {
      fields(row, ["name", "uid"], ["isRoot"]);
      reportText(row.uid);
      if (node === data.tree || !own(parts, row.uid as string))
        invalid("Invalid tree part reference.");
    }
  }
  return data as unknown as VisualizerData;
};

export const parseReportJson = (
  source: string,
  overrides: Partial<ShareLimits> = {},
): VisualizerData => {
  const limits = resolveLimits(overrides);
  budget(new TextEncoder().encode(source).length, limits.maxFileBytes, "Raw-data file");
  const data = parseJson(
    source.replace(/^\uFEFF/, ""),
    Math.max(limits.maxJsonDepth, limits.maxTreeDepth * 2 + 8),
  );
  return validateReport(data, limits);
};

export const treeEqual = (
  a: ModuleTree | ModuleTreeLeaf,
  b: ModuleTree | ModuleTreeLeaf,
): boolean => {
  const pending = [[a, b]];
  while (pending.length) {
    const [x, y] = pending.pop()!;
    if (
      x.name !== y.name ||
      own(x, "isRoot") !== own(y, "isRoot") ||
      (x as { isRoot?: boolean }).isRoot !== (y as { isRoot?: boolean }).isRoot
    )
      return false;
    if ("children" in x && "children" in y) {
      if (x.children.length !== y.children.length) return false;
      for (let i = 0; i < x.children.length; i++) pending.push([x.children[i], y.children[i]]);
    } else if ("uid" in x && "uid" in y) {
      if (x.uid !== y.uid) return false;
    } else return false;
  }
  return true;
};
