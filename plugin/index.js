"use strict";

const fs = require("fs");
const path = require("path");
const { promisify } = require("util");

const mkdirp = require("mkdirp");

const mkdir = promisify(mkdirp);
const writeFile = promisify(fs.writeFile);

const opn = require("open");

const TEMPLATE = require("./template-types");

const ModuleMapper = require("./module-mapper");

const buildStats = require("./build-stats");
const { buildTree, mergeTrees, addLinks, removeCommonPrefix } = require("./data");
const addMinifiedSizesToModules = require("./sourcemap");

const WARN_SOURCEMAP_DISABLED =
  "rollup output configuration missing sourcemap = true. You should add output.sourcemap = true or disable sourcemap in this plugin";
const WARN_SOURCEMAP_MISSING = id => `${id} missing source map`;

module.exports = function(opts) {
  opts = opts || {};
  const json = !!opts.json;
  const filename = opts.filename || (json ? "stats.json" : "stats.html");
  const title = opts.title || "RollUp Visualizer";

  const useSourceMap = !!opts.sourcemap;
  const open = !!opts.open;
  const openOptions = opts.openOptions || {};

  const template = opts.template || "treemap";
  if (!TEMPLATE.includes(template)) {
    throw new Error(`Unknown template type ${template}`);
  }

  let extraStylePath = opts.extraStylePath;
  if (opts.styleOverridePath) {
    console.warn("[rollup-plugin-visualizer] `styleOverridePath` was renamed to `extraStylePath`");
    extraStylePath = opts.styleOverridePath;
  }

  const chartParameters = opts.chartParameters || {};

  return {
    name: "visualizer",

    async generateBundle(outputOptions, outputBundle) {
      if (useSourceMap && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      const roots = [];
      const mapper = new ModuleMapper();
      const links = [];

      // collect trees
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

        const tree = buildTree(id, Object.keys(bundle.modules), getInitialModuleData, mapper);

        roots.push(tree);
      }

      // after trees we process links (this is mostly for uids)
      for (const bundle of Object.values(outputBundle)) {
        if (bundle.isAsset || bundle.facadeModuleId == null) continue; //only chunks

        addLinks(bundle.facadeModuleId, this.getModuleInfo.bind(this), links, mapper);
      }

      const tree = mergeTrees(roots);

      const { nodes, nodeIds } = mapper;
      removeCommonPrefix(nodeIds);

      for (const [id, uid] of Object.entries(nodeIds)) {
        if (nodes[uid]) {
          nodes[uid].id = id;
        } else {
          this.warn(`Could not find mapping for node ${id} ${uid}`);
        }
      }

      const data = { tree, nodes, links };

      const fileContent = json
        ? JSON.stringify(data, null, 2)
        : await buildStats(title, data, template, extraStylePath, chartParameters);

      await mkdir(path.dirname(filename));
      await writeFile(filename, fileContent);

      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};
