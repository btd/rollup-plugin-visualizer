import {
  isModuleTree,
  type ModuleLengths,
  type ModuleTree,
  type ModuleTreeLeaf,
  type SizeKey,
  type VisualizerData,
} from "../../shared/types";

export type Target = { type: "output"; key: string } | { type: "module"; uid: string };
export const outputTarget = (key: string): Target => ({ type: "output", key });
export const moduleTarget = (uid: string): Target => ({ type: "module", uid });
export const targetId = (target: Target): string =>
  target.type === "output" ? `output:${target.key}` : `module:${target.uid}`;
export interface OutputNode {
  key: string;
  name: string;
  path: string;
  parent?: OutputNode;
  children: OutputNode[];
  partUid?: string;
  metaUid?: string;
  chunk?: string;
  chunkKey?: string;
  sizes: ModuleLengths;
}
export interface Edge {
  source: string;
  target: string;
  dynamic: boolean;
}
export interface Occurrence {
  uid: string;
  chunk: string;
  sizes: ModuleLengths;
  node: OutputNode;
}
export interface Relationships {
  incoming: Edge[];
  outgoing: Edge[];
  internal: Edge[];
}
const zero = (): ModuleLengths => ({ renderedLength: 0, gzipLength: 0, brotliLength: 0 });
const keys: SizeKey[] = ["renderedLength", "gzipLength", "brotliLength"];
export const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Index report identities once; chart geometry and interactive filters are separate. */
export class InspectorData {
  readonly nodes = new Map<string, OutputNode>();
  readonly partNodes = new Map<string, OutputNode>();
  readonly chunkSizes = new Map<string, ModuleLengths>();
  readonly root: OutputNode;
  private readonly incoming = new Map<string, Edge[]>();
  private readonly outgoing = new Map<string, Edge[]>();
  private readonly memberCache = new Map<string, OutputNode[]>();
  private readonly relationCache = new Map<string, Relationships>();
  private readonly partChunks = new Map<string, string>();

  constructor(readonly data: VisualizerData) {
    for (const meta of Object.values(data.nodeMetas)) {
      for (const [chunk, uid] of Object.entries(meta.moduleParts)) this.partChunks.set(uid, chunk);
    }
    this.root = this.index(data.tree, "root");
    this.root.children.forEach((node) => {
      this.chunkSizes.set(node.key, node.sizes);
    });
    const seen = new Set<string>();
    for (const [source, meta] of Object.entries(data.nodeMetas)) {
      for (const link of meta.imported) {
        const edge = { source, target: link.uid, dynamic: !!link.dynamic };
        const key = JSON.stringify([source, edge.target, edge.dynamic]);
        if (seen.has(key)) continue;
        seen.add(key);
        const incoming = this.incoming.get(edge.target) ?? [];
        incoming.push(edge);
        this.incoming.set(edge.target, incoming);
        const outgoing = this.outgoing.get(source) ?? [];
        outgoing.push(edge);
        this.outgoing.set(source, outgoing);
      }
    }
  }

  private index(tree: ModuleTree | ModuleTreeLeaf, key: string, parent?: OutputNode): OutputNode {
    const node: OutputNode = {
      key,
      name: tree.name,
      path: parent ? `${parent.path}/${tree.name}` : tree.name,
      parent,
      children: [],
      sizes: zero(),
      chunkKey: parent?.key === "root" ? key : parent?.chunkKey,
      chunk:
        parent === undefined
          ? undefined
          : parent === this.nodes.get("root")
            ? tree.name
            : parent.chunk,
    };
    this.nodes.set(key, node);
    if (isModuleTree(tree)) {
      node.children = tree.children.map((child, index) =>
        this.index(child, `${key}/${index}`, node),
      );
      for (const child of node.children)
        for (const sizeKey of keys) node.sizes[sizeKey] += child.sizes[sizeKey];
    } else {
      const part = this.data.nodeParts[tree.uid];
      node.partUid = tree.uid;
      node.metaUid = part.metaUid;
      node.chunk = this.partChunks.get(tree.uid)!;
      node.sizes = {
        renderedLength: part.renderedLength,
        gzipLength: part.gzipLength,
        brotliLength: part.brotliLength,
      };
      this.partNodes.set(tree.uid, node);
    }
    return node;
  }

  node(target: Target): OutputNode | undefined {
    return target.type === "output" ? this.nodes.get(target.key) : undefined;
  }
  metaUid(target: Target): string | undefined {
    return target.type === "module" ? target.uid : this.node(target)?.metaUid;
  }
  path(target: Target): string {
    const uid = this.metaUid(target);
    return uid === undefined ? this.node(target)!.path : this.data.nodeMetas[uid].id;
  }
  isGroup(target: Target): boolean {
    return target.type === "output" && this.node(target)!.partUid === undefined;
  }

  members(target: Target): OutputNode[] {
    const id = targetId(target);
    const cached = this.memberCache.get(id);
    if (cached) return cached;
    const node = this.node(target);
    let result: OutputNode[];
    if (!node) result = this.parts(target).map((part) => part.node);
    else {
      result = [];
      const stack = [node];
      while (stack.length) {
        const current = stack.pop()!;
        if (current.partUid !== undefined) result.push(current);
        else for (const child of current.children) stack.push(child);
      }
    }
    result.sort(
      (a, b) =>
        compare(this.data.nodeMetas[a.metaUid!].id, this.data.nodeMetas[b.metaUid!].id) ||
        compare(a.key, b.key),
    );
    this.memberCache.set(id, result);
    return result;
  }

  parts(target: Target): Occurrence[] {
    const node = this.node(target);
    if (node?.partUid !== undefined)
      return [{ uid: node.partUid, chunk: node.chunk!, sizes: node.sizes, node }];
    if (target.type !== "module") return [];
    return Object.entries(this.data.nodeMetas[target.uid].moduleParts)
      .map(([chunk, uid]) => ({
        uid,
        chunk,
        sizes: this.data.nodeParts[uid],
        node: this.partNodes.get(uid)!,
      }))
      .toSorted((a, b) => compare(a.chunk, b.chunk));
  }
  size(target: Target, metric: SizeKey): number | undefined {
    const node = this.node(target);
    if (node) return node.sizes[metric];
    const parts = this.parts(target);
    return parts.length === 1 ? parts[0].sizes[metric] : undefined;
  }
  scope(target: Target): { label: string; size: ModuleLengths } {
    const node = this.node(target) ?? this.parts(target)[0]?.node;
    return node?.chunkKey
      ? { label: node.chunk!, size: this.chunkSizes.get(node.chunkKey)! }
      : { label: "report", size: this.root.sizes };
  }
  ancestors(node: OutputNode): OutputNode[] {
    const result: OutputNode[] = [];
    for (let current: OutputNode | undefined = node; current; current = current.parent)
      result.unshift(current);
    return result;
  }

  relationships(target: Target): Relationships {
    const id = targetId(target);
    const cached = this.relationCache.get(id);
    if (cached) return cached;
    const group = this.isGroup(target);
    const uids = new Set(
      group ? this.members(target).map((node) => node.metaUid!) : [this.metaUid(target)!],
    );
    const incoming: Edge[] = [],
      outgoing: Edge[] = [],
      internal: Edge[] = [];
    for (const uid of uids) {
      for (const edge of this.incoming.get(uid) ?? []) {
        if (!group || !uids.has(edge.source)) incoming.push(edge);
      }
      for (const edge of this.outgoing.get(uid) ?? []) {
        if (!group || !uids.has(edge.target)) outgoing.push(edge);
        else internal.push(edge);
      }
    }
    const sort = (edges: Edge[], direction: "source" | "target") =>
      edges.toSorted((a, b) => {
        const secondary = direction === "source" ? "target" : "source";
        return (
          compare(this.data.nodeMetas[a[direction]].id, this.data.nodeMetas[b[direction]].id) ||
          compare(this.data.nodeMetas[a[secondary]].id, this.data.nodeMetas[b[secondary]].id) ||
          Number(a.dynamic) - Number(b.dynamic) ||
          compare(a.source, b.source) ||
          compare(a.target, b.target)
        );
      });
    const result = {
      incoming: sort(incoming, "source"),
      outgoing: sort(outgoing, "target"),
      internal: sort(internal, "source"),
    };
    this.relationCache.set(id, result);
    return result;
  }
}
