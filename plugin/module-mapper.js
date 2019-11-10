"use strict";

class ModuleMapper {
  constructor() {
    this.id = 0;
    this.nodes = Object.create(null);
    this.nodeIds = Object.create(null);
  }

  getUid(moduleId) {
    if (!(moduleId in this.nodeIds)) {
      const id = this.id;
      this.nodeIds[moduleId] = id;
      this.id += 1;
    }
    return this.nodeIds[moduleId];
  }

  setValueByModuleId(moduleId, value) {
    const uid = this.getUid(moduleId);
    if (uid in this.nodes) {
      console.warn("Override", moduleId, uid, value, this.nodes[uid]);
    }
    this.nodes[uid] = value;
    return uid;
  }

  getValue(uid) {
    return this.nodes[uid];
  }
}

module.exports = ModuleMapper;
