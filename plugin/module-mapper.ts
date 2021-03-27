import { customAlphabet } from "nanoid/non-secure";
import { ModuleRenderInfo, ModuleUID } from "../types/types";
import { warn } from "./warn";

const nanoid = customAlphabet("1234567890abcdef", 4);

export class ModuleMapper {
  id = 0;
  prefix = nanoid();
  nodes: Record<ModuleUID, ModuleRenderInfo> = {};
  nodeIds: Record<string, ModuleUID> = {};

  getUid(moduleId: string): string {
    if (!(moduleId in this.nodeIds)) {
      const id = this.id;
      this.nodeIds[moduleId] = `${this.prefix}-${id}`;
      this.id += 1;
    }
    return this.nodeIds[moduleId];
  }

  setValueByModuleId(moduleId: string, value: ModuleRenderInfo): ModuleUID {
    const uid = this.getUid(moduleId);
    if (uid in this.nodes) {
      warn(
        "Override (probably this is a bug)",
        moduleId,
        uid,
        value,
        this.nodes[uid]
      );
    }
    this.nodes[uid] = value;
    return uid;
  }

  getValue(uid: ModuleUID, defaultValue: ModuleRenderInfo): ModuleRenderInfo {
    if (!(uid in this.nodes)) {
      this.nodes[uid] = defaultValue;
    }
    return this.nodes[uid];
  }
}
