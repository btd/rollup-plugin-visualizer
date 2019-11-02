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

const HIERARCHY = "hierarchy";
const GRAPH = "graph";

const DATA_TYPE_FOR_TEMPLATE = {
  circlepacking: HIERARCHY,
  sunburst: HIERARCHY,
  treemap: HIERARCHY,
  network: GRAPH
};

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

  const bundlesRelative = !!opts.bundlesRelative;

  const chartParameters = opts.chartParameters || {};

  return {
    name: "visualizer",

    async generateBundle(outputOptions, outputBundle) {
      if (useSourceMap && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      let roots = [];

      const dataType = DATA_TYPE_FOR_TEMPLATE[template];

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

        let root = null;
        switch (dataType) {
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
            this.error(`Unknown template ${template} type`);
          }
        }

        roots.push({ id, root });
      }

      const id = "bundles";
      if (bundlesRelative) {
        switch (dataType) {
          case HIERARCHY: {
            roots = mergeTrees(id, roots);
            break;
          }
          case GRAPH: {
            roots = mergeGraphs(id, roots);
            break;
          }
        }

        roots = [roots];
      }

      const html = await buildStats(title, roots, template, styleOverridePath, chartParameters);

      await mkdir(path.dirname(filename));
      await writeFile(filename, html);

      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};
