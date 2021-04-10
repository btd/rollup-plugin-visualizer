import { customAlphabet } from "nanoid/non-secure";
import { ModuleRenderInfo, ModuleUID } from "../types/types";

const nanoid = customAlphabet("1234567890abcdef", 4);

const UNIQUE_PREFIX = nanoid();
let COUNTER = 0;

const uniqueId = (): ModuleUID => `${UNIQUE_PREFIX}-${COUNTER++}`;

type ModuleIdStorage = {
  bundles: Record<string, ModuleUID>;
  uid: ModuleUID;
};

export class ModuleMapper {
  private nodes: Record<ModuleUID, ModuleRenderInfo> = {};
  private nodeIds: Record<string, ModuleIdStorage> = {};

  constructor(private projectRoot: string | RegExp) {}

  trimProjectRootId(moduleId: string): string {
    return moduleId.replace(this.projectRoot, "");
  }

  getModuleUid(moduleId: string): ModuleUID {
    if (!(moduleId in this.nodeIds)) {
      this.nodeIds[moduleId] = { bundles: {}, uid: uniqueId() };
    }

    return this.nodeIds[moduleId].uid;
  }

  getBundleModuleUid(bundleId: string, moduleId: string): ModuleUID {
    if (!(moduleId in this.nodeIds)) {
      this.nodeIds[moduleId] = { bundles: {}, uid: uniqueId() };
    }
    if (!(bundleId in this.nodeIds[moduleId].bundles)) {
      this.nodeIds[moduleId].bundles[bundleId] = uniqueId();
    }

    return this.nodeIds[moduleId].bundles[bundleId];
  }

  setValue(bundleId: string, moduleId: string, value: Omit<ModuleRenderInfo, "id">): ModuleUID {
    const uid = this.getBundleModuleUid(bundleId, moduleId);
    if (uid in this.nodes) {
      throw new Error(
        `Override module: bundle id ${bundleId}, module id ${moduleId}, value ${JSON.stringify(
          value
        )}, existing value: ${JSON.stringify(this.nodes[uid])}`
      );
    }
    const id = this.trimProjectRootId(moduleId);
    this.nodes[uid] = { ...value, id };
    return uid;
  }

  appendValue(bundleId: string, moduleId: string, value: Partial<Omit<ModuleRenderInfo, "id">>): ModuleUID {
    const uid = this.getBundleModuleUid(bundleId, moduleId);
    if (!(uid in this.nodes)) {
      throw new Error(`Missing module: bundle id ${bundleId}, module id ${moduleId}, value ${JSON.stringify(value)}`);
    }
    const id = this.trimProjectRootId(moduleId);
    this.nodes[uid] = { ...this.nodes[uid], ...value, id };
    return uid;
  }

  hasValue(bundleId: string, moduleId: string): boolean {
    return !!this.nodeIds?.[moduleId]?.bundles?.[bundleId];
  }

  getNodes(): ModuleMapper["nodes"] {
    return this.nodes;
  }

  getNodeParts(): Record<ModuleUID, Record<string, ModuleUID>> {
    return Object.fromEntries(Object.values(this.nodeIds).map((val) => [val.uid, val.bundles]));
  }
}
