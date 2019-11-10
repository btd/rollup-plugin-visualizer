"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const mkdirp = require("mkdirp");

const mkdir = promisify(mkdirp);
const writeFile = promisify(fs.writeFile);

const opn = require("open");

const buildStats = require("./build-stats");
const { buildTree, mergeTrees } = require("./hierarchy");
const { buildGraph, mergeGraphs } = require("./graph");
const addMinifiedSizesToModules = require("./sourcemap");

const WARN_SOURCEMAP_DISABLED =
  "rollup output configuration missing sourcemap = true. You should add output.sourcemap = true or disable sourcemap in this plugin";
const WARN_SOURCEMAP_MISSING = id => `${id} missing source map`;

module.exports = function(opts) {
  opts = opts || {};
  const filename = opts.filename || "stats.html";
  const title = opts.title || "RollUp Visualizer";

  const useSourceMap = !!opts.sourcemap;
  const open = !!opts.open;
  const openOptions = opts.openOptions || {};

  const template = opts.template || "sunburst";
  const styleOverridePath = opts.styleOverridePath;

  const chartParameters = opts.chartParameters || {};

  return {
    name: "visualizer",

    async generateBundle(outputOptions, outputBundle) {
      if (useSourceMap && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      const roots = [];

      for (const [id, bundle] of Object.entries(outputBundle)) {
        if (bundle.isAsset) continue; //only chunks

        if (useSourceMap) {
          if (!bundle.map) {
            this.warn(WARN_SOURCEMAP_MISSING(id));
          }
          await addMinifiedSizesToModules(bundle);
        }

        const getInitialModuleData = id => {
          const mod = bundle.modules[id];

          return {
            size: useSourceMap ? mod.minifiedSize || 0 : mod.renderedLength,
            originalSize: mod.originalLength
          };
        };

        /*const graph = buildGraph(
          bundle.facadeModuleId,
          this.getModuleInfo.bind(this),
          getInitialModuleData
        );*/

        const tree = buildTree(id, Object.keys(bundle.modules), getInitialModuleData);

        roots.push({ ...tree });
      }

      const { tree, nodes } = mergeTrees(roots);

      const data = { tree, nodes };

      const html = await buildStats(title, data, template, styleOverridePath, chartParameters);

      await mkdir(path.dirname(filename));
      await writeFile(filename, html);

      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};
