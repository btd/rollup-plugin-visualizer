"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

const opn = require("open");

const buildStats = require("./build-stats");
const buildTree = require("./hierarchy");
const addMinifiedSizesToModules = require("./sourcemap");

module.exports = function(opts) {
  opts = opts || {};
  const filename = opts.filename || "stats.html";
  const title = opts.title || "RollUp Visualizer";
  const useSourceMap = !!opts.sourcemap;
  const open = !!opts.open;
  const openOptions = opts.openOptions || {};

  const template = opts.template || "sunburst";

  return {
    async generateBundle(outputOptions, outputBundle) {
      const roots = [];

      for (const [id, bundle] of Object.entries(outputBundle)) {
        if (bundle.isAsset) continue; //only chunks

        if (useSourceMap) {
          await addMinifiedSizesToModules(bundle);
        }
        const root = buildTree(bundle, useSourceMap);

        roots.push({ id, root });
      }

      const html = await buildStats(title, roots, template);
      await mkdir(path.dirname(filename), { recursive: true });
      await writeFile(filename, html);
      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};
