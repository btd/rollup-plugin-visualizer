import {
  ModuleImport,
  ModuleMeta,
  ModulePart,
  ModuleLengths,
  ModuleUID,
  VisualizerData,
} from "../shared/types.js";
import * as crypto from "node:crypto";

const HASH_PLACEHOLDER = "!{ROLLUP_VISUALIZER_HASH_PLACEHOLDER}";
const HASH_PLACEHOLDER_REGEXP = new RegExp(`"${HASH_PLACEHOLDER}-(\\d+)"`, "g");

type ModuleIdStorage = {
  uid: ModuleUID;
  meta: Omit<ModuleMeta, "imported" | "importedBy"> & {
    imported: Set<string>;
    importedBy: Set<string>;
  };
};

export const getDataHash = (json: string) => {
  const hash = crypto.createHash("sha1").update(json).digest("hex");
  const hashSub = hash.substring(0, 8);
  return hashSub;
};

export const replaceHashPlaceholders = (data: VisualizerData) => {
  const json = JSON.stringify(data);
  const hash = getDataHash(json);
  const jsonWithHash = json.replace(HASH_PLACEHOLDER_REGEXP, (_, num) => `"${hash}-${num}"`);
  return jsonWithHash;
};

export class ModuleMapper {
  private nodeParts: Record<ModuleUID, ModulePart> = {};
  private nodeMetas: Record<string, ModuleIdStorage> = {};
  private counter: number = 0;

  constructor(private projectRoot: string | RegExp) {}

  trimProjectRootId(moduleId: string): string {
    if (typeof this.projectRoot === "string" && moduleId.startsWith(this.projectRoot)) {
      return moduleId.slice(this.projectRoot.length);
    }
    return moduleId.replace(this.projectRoot, "");
  }

  uniqueId(): ModuleUID {
    return `${HASH_PLACEHOLDER}-${this.counter++}`;
  }

  getModuleUid(moduleId: string): ModuleUID {
    if (!(moduleId in this.nodeMetas)) {
      this.nodeMetas[moduleId] = {
        uid: this.uniqueId(),
        meta: {
          id: this.trimProjectRootId(moduleId),
          moduleParts: {},
          imported: new Set(),
          importedBy: new Set(),
        },
      };
    }

    return this.nodeMetas[moduleId].uid;
  }

  getBundleModuleUid(bundleId: string, moduleId: string): ModuleUID {
    if (!(moduleId in this.nodeMetas)) {
      this.nodeMetas[moduleId] = {
        uid: this.uniqueId(),
        meta: {
          id: this.trimProjectRootId(moduleId),
          moduleParts: {},
          imported: new Set(),
          importedBy: new Set(),
        },
      };
    }
    if (!(bundleId in this.nodeMetas[moduleId].meta.moduleParts)) {
      this.nodeMetas[moduleId].meta.moduleParts[bundleId] = this.uniqueId();
    }

    return this.nodeMetas[moduleId].meta.moduleParts[bundleId];
  }

  setNodePart(bundleId: string, moduleId: string, value: ModuleLengths): ModuleUID {
    const uid = this.getBundleModuleUid(bundleId, moduleId);
    if (uid in this.nodeParts) {
      throw new Error(
        `Override module: bundle id ${bundleId}, module id ${moduleId}, value ${JSON.stringify(
          value,
        )}, existing value: ${JSON.stringify(this.nodeParts[uid])}`,
      );
    }
    this.nodeParts[uid] = { ...value, metaUid: this.getModuleUid(moduleId) };
    return uid;
  }

  setNodeMeta(moduleId: string, value: { isEntry?: boolean; isExternal?: boolean }): void {
    this.getModuleUid(moduleId);
    this.nodeMetas[moduleId].meta.isEntry = value.isEntry;
    this.nodeMetas[moduleId].meta.isExternal = value.isExternal;
  }

  hasNodePart(bundleId: string, moduleId: string): boolean {
    if (!(moduleId in this.nodeMetas)) {
      return false;
    }
    if (!(bundleId in this.nodeMetas[moduleId].meta.moduleParts)) {
      return false;
    }
    if (!(this.nodeMetas[moduleId].meta.moduleParts[bundleId] in this.nodeParts)) {
      return false;
    }
    return true;
  }

  getNodeParts(): ModuleMapper["nodeParts"] {
    return this.nodeParts;
  }

  getNodeMetas(): Record<ModuleUID, ModuleMeta> {
    const nodeMetas: Record<ModuleUID, ModuleMeta> = {};
    for (const { uid, meta } of Object.values(this.nodeMetas)) {
      nodeMetas[uid] = {
        ...meta,
        imported: [...meta.imported].map((rawImport) => {
          const [uid, dynamic] = rawImport.split(",");
          const importData: ModuleImport = { uid };
          if (dynamic === "true") {
            importData.dynamic = true;
          }
          return importData;
        }),
        importedBy: [...meta.importedBy].map((rawImport) => {
          const [uid, dynamic] = rawImport.split(",");
          const importData: ModuleImport = { uid };
          if (dynamic === "true") {
            importData.dynamic = true;
          }
          return importData;
        }),
      };
    }
    return nodeMetas;
  }

  addImportedByLink(targetId: string, sourceId: string): void {
    const sourceUid = this.getModuleUid(sourceId);
    this.getModuleUid(targetId);
    this.nodeMetas[targetId].meta.importedBy.add(sourceUid);
  }

  addImportedLink(sourceId: string, targetId: string, dynamic = false): void {
    const targetUid = this.getModuleUid(targetId);
    this.getModuleUid(sourceId);
    this.nodeMetas[sourceId].meta.imported.add(String([targetUid, dynamic]));
  }
}
