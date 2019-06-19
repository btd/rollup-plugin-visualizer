"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const mkdirp = require("mkdirp");

const mkdir = promisify(mkdirp);
const writeFile = promisify(fs.writeFile);

const opn = require("open");

const buildStats = require("./build-stats");
const buildTree = require("./hierarchy");
const buildGraph = require("./graph");
const addMinifiedSizesToModules = require("./sourcemap");

const HIERARCHY = "hierarchy";
const GRAPH = "graph";

const DATA_TYPE_FOR_TEMPLATE = {
  circlepacking: HIERARCHY,
  sunburst: HIERARCHY,
  treemap: HIERARCHY,
  network: GRAPH
};

module.exports = function(opts) {
  opts = opts || {};
  const filename = opts.filename || "stats.html";
  const title = opts.title || "RollUp Visualizer";
  const useSourceMap = !!opts.sourcemap;
  const open = !!opts.open;
  const openOptions = opts.openOptions || {};

  const template = opts.template || "sunburst";

  return {
    name: "visualizer",

    async generateBundle(outputOptions, outputBundle) {
      const roots = [];

      for (const [id, bundle] of Object.entries(outputBundle)) {
        if (bundle.isAsset) continue; //only chunks

        if (useSourceMap) {
          await addMinifiedSizesToModules(bundle);
        }

        const getInitialModuleData = id => {
          const mod = bundle.modules[id];

          return {
            size: useSourceMap ? mod.minifiedSize || 0 : mod.renderedLength,
            originalSize: mod.originalLength
          };
        };

        let root = null;
        switch (DATA_TYPE_FOR_TEMPLATE[template]) {
          case HIERARCHY: {
            root = buildTree(Object.keys(bundle.modules), getInitialModuleData);
            break;
          }
          case GRAPH: {
            root = buildGraph(
              bundle.facadeModuleId,
              this.getModuleInfo.bind(this),
              getInitialModuleData
            );
            break;
          }
          default: {
            this.error(`Unknown template ${template}`);
          }
        }

        roots.push({ id, root });
      }

      const html = await buildStats(title, roots, template);

      await mkdir(path.dirname(filename));
      await writeFile(filename, html);

      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};
