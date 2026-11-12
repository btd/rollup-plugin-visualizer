import type { BundlerOutputBundle, GetModuleInfo } from "./bundler-types.js";
import type { ModuleLengths, ModuleTree, ModuleTreeLeaf, VisualizerData } from "../shared/types.js";
import { createFilter, type Filter } from "../shared/create-filter.js";
import { buildTree, mergeTrees } from "./data.js";
import { ModuleMapper } from "./module-mapper.js";
import { getSourcemapModules } from "./sourcemap.js";

type CodeContribution = { id: string; code: string | null };
type Contribution = CodeContribution | { id: string; renderedLength: number };
type ReportModule = { id: string; isEntry?: boolean; isExternal?: boolean };
type CollectedModule = ReportModule & {
  bundles: Set<string>;
  // Membership alone does not create a displayed node without attribution or
  // dependency-graph evidence.
  isGraphNode: boolean;
};
type ReportLink = { source: string; target: string; dynamic?: boolean };
type ReportChunk = { id: string } & (
  { kind: "modules"; parts: Contribution[] } | { kind: "fallback"; part: CodeContribution }
);

export type CollectedReport = {
  chunks: (ReportChunk & { outputModuleIds: string[] })[];
  modules: Map<string, CollectedModule>;
  links: ReportLink[];
};

export type SelectedReport = {
  chunks: ReportChunk[];
  modules: Map<string, ReportModule>;
  links: ReportLink[];
};

// Collect original identities and attribution facts. No config selection or
// projectRoot trimming takes place until the collection is complete.
export const collectReport = async (
  outputBundle: BundlerOutputBundle,
  options: {
    sourcemap: boolean;
    dir: string;
    getModuleInfo: GetModuleInfo;
    warn: (message: string) => void;
  },
): Promise<CollectedReport> => {
  const report: CollectedReport = { chunks: [], modules: new Map(), links: [] };
  const getModule = (id: string): CollectedModule => {
    let module = report.modules.get(id);
    if (module == null) {
      module = { id, bundles: new Set(), isGraphNode: false };
      report.modules.set(id, module);
    }
    return module;
  };
  for (const [id, chunk] of Object.entries(outputBundle)) {
    if (chunk.type !== "chunk") continue;
    const outputModuleIds = Object.keys(chunk.modules);
    for (const moduleId of outputModuleIds) getModule(moduleId).bundles.add(id);
    let parts: Contribution[];
    if (options.sourcemap) {
      if (!chunk.map) options.warn(`${id} missing source map`);
      parts = Object.values(await getSourcemapModules(id, chunk, options.dir));
    } else {
      parts = Object.entries(chunk.modules).map(([moduleId, { code }]) => ({ id: moduleId, code }));
    }
    for (const part of parts) getModule(part.id).bundles.add(id);
    report.chunks.push(
      parts.length
        ? { id, outputModuleIds, kind: "modules", parts }
        : {
            id,
            outputModuleIds,
            kind: "fallback",
            part: {
              id: chunk.facadeModuleId ?? `${id}-unknown`,
              code: chunk.code,
            },
          },
    );
  }

  // Visit each source module once, even when multiple chunks share its graph.
  // Traversal is independent of eventual report eligibility.
  const visited = new Set<string>();
  for (const chunk of Object.values(outputBundle)) {
    if (chunk.type !== "chunk" || chunk.facadeModuleId == null) continue;
    const queue: string[] = [];
    const enqueue = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      queue.push(id);
    };
    enqueue(chunk.facadeModuleId);
    for (const id of queue) {
      const info = options.getModuleInfo(id);
      if (info == null) continue;
      const module = getModule(id);
      if (info.isEntry) {
        module.isEntry = true;
        module.isGraphNode = true;
      }
      if (info.isExternal) {
        module.isExternal = true;
        module.isGraphNode = true;
      }
      const addLink = (target: string, dynamic?: boolean) => {
        module.isGraphNode = true;
        getModule(target).isGraphNode = true;
        report.links.push({ source: id, target, dynamic });
        enqueue(target);
      };
      for (const target of info.importedIds) addLink(target);
      for (const target of info.dynamicallyImportedIds ?? []) addLink(target, true);
    }
  }
  return report;
};

// The sole owner of configured include/exclude policy. Everything returned here
// can be measured and serialized without deciding eligibility again.
export const selectReport = (
  collected: CollectedReport,
  include: Filter | Filter[] | undefined,
  exclude: Filter | Filter[] | undefined,
): SelectedReport => {
  const matches = createFilter(include, exclude);
  const chunks: ReportChunk[] = [];
  const contributingIds = new Set<string>();
  for (const chunk of collected.chunks) {
    if (chunk.kind === "modules") {
      const parts = chunk.parts.filter((part) => matches(chunk.id, part.id));
      if (!parts.length) continue;
      chunks.push({ id: chunk.id, kind: "modules", parts });
      for (const part of parts) contributingIds.add(part.id);
    } else {
      // Missing attribution is a collected fact, never a consequence of
      // filtering. Known output modules and the fallback identity must allow it.
      if (!matches(chunk.id, chunk.part.id)) continue;
      if (
        chunk.outputModuleIds.length &&
        !chunk.outputModuleIds.some((id) => matches(chunk.id, id))
      )
        continue;
      chunks.push({ id: chunk.id, kind: "fallback", part: chunk.part });
      contributingIds.add(chunk.part.id);
    }
  }
  const modules = new Map<string, ReportModule>();
  for (const [id, module] of collected.modules) {
    const allowed = module.bundles.size
      ? [...module.bundles].some((bundle) => matches(bundle, id))
      : matches("", id);
    if (contributingIds.has(id) || (module.isGraphNode && allowed)) {
      modules.set(id, { id, isEntry: module.isEntry, isExternal: module.isExternal });
    }
  }
  for (const chunk of chunks) {
    if (chunk.kind !== "fallback") continue;
    const id = chunk.part.id;
    modules.set(id, { ...modules.get(id), id, isEntry: true });
  }
  const links = collected.links.filter(
    (link) => modules.has(link.source) && modules.has(link.target),
  );
  return { chunks, modules, links };
};

export const buildReport = async (
  selected: SelectedReport,
  projectRoot: string | RegExp,
  measure: (part: CodeContribution) => Promise<ModuleLengths & { id: string }>,
): Promise<Pick<VisualizerData, "tree" | "nodeParts" | "nodeMetas">> => {
  const mapper = new ModuleMapper(projectRoot);
  const roots: (ModuleTree | ModuleTreeLeaf)[] = [];
  for (const chunk of selected.chunks) {
    if (chunk.kind === "fallback") {
      const sizes = await measure({ id: chunk.id, code: chunk.part.code });
      const uid = mapper.setNodePart(chunk.id, chunk.part.id, sizes);
      roots.push({ name: chunk.id, uid });
    } else {
      const parts = await Promise.all(
        chunk.parts.map((part) =>
          "code" in part ? measure(part) : { ...part, gzipLength: 0, brotliLength: 0 },
        ),
      );
      roots.push(buildTree(chunk.id, parts, mapper));
    }
  }
  for (const module of selected.modules.values()) mapper.setNodeMeta(module.id, module);
  for (const link of selected.links) {
    mapper.addImportedByLink(link.target, link.source);
    mapper.addImportedLink(link.source, link.target, link.dynamic);
  }
  return {
    tree: mergeTrees(roots),
    nodeParts: mapper.getNodeParts(),
    nodeMetas: mapper.getNodeMetas(),
  };
};
