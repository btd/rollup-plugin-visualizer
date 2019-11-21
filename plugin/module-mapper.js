"use strict";

const generate = require("nanoid/non-secure/generate");
const warn = require("./warn");

class ModuleMapper {
  constructor() {
    this.id = 0;
    this.prefix = generate("1234567890abcdef", 4);
    this.nodes = Object.create(null);
    this.nodeIds = Object.create(null);
  }

  getUid(moduleId) {
    if (!(moduleId in this.nodeIds)) {
      const id = this.id;
      this.nodeIds[moduleId] = `${this.prefix}-${id}`;
      this.id += 1;
    }
    return this.nodeIds[moduleId];
  }

  setValueByModuleId(moduleId, value) {
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

  getValue(uid, defaultValue) {
    if (!(uid in this.nodes)) {
      this.nodes[uid] = defaultValue;
    }
    return this.nodes[uid];
  }
}

module.exports = ModuleMapper;
