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
const JSON_VERSION = require("./version");
const {
  buildTree,
  mergeTrees,
  addLinks,
  removeCommonPrefix
} = require("./data");
const addMinifiedSizesToModules = require("./sourcemap");
const warn = require("./warn");

const WARN_SOURCEMAP_DISABLED =
  "rollup output configuration missing sourcemap = true. You should add output.sourcemap = true or disable sourcemap in this plugin";
const WARN_SOURCEMAP_MISSING = id => `${id} missing source map`;

module.exports = function(opts) {
  opts = opts || {};
  const json = !!opts.json;
  const filename = opts.filename || (json ? "stats.json" : "stats.html");
  const title = opts.title || "RollUp Visualizer";

  const open = !!opts.open;
  const openOptions = opts.openOptions || {};

  const template = opts.template || "treemap";
  if (!TEMPLATE.includes(template)) {
    throw new Error(`Unknown template type ${template}. Known: ${TEMPLATE}`);
  }

  let extraStylePath = opts.extraStylePath;
  if ("styleOverridePath" in opts) {
    warn(
      "`styleOverridePath` was renamed to `extraStylePath`, but will be removed in next major version"
    );
    extraStylePath = opts.styleOverridePath;
  }

  const chartParameters = opts.chartParameters || {};

  return {
    name: "visualizer",

    async generateBundle(outputOptions, outputBundle) {
      const computedSourcemapSize = !!opts.sourcemap;
      if (computedSourcemapSize && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      const roots = [];
      const mapper = new ModuleMapper();
      const links = [];

      // collect trees
      for (const [id, bundle] of Object.entries(outputBundle)) {
        if (bundle.isAsset) continue; //only chunks

        const computedLengths = Object.create(null);

        if (computedSourcemapSize) {
          if (!bundle.map) {
            this.warn(WARN_SOURCEMAP_MISSING(id));
          }
          await addMinifiedSizesToModules(bundle, computedLengths);
        }

        const getInitialModuleData = id => {
          const mod = bundle.modules[id];

          return {
            renderedLength: opts.sourcemap
              ? (computedLengths[id] || {}).sourcemapLength || 0
              : mod.renderedLength,
            originalLength: mod.originalLength
          };
        };

        const tree = buildTree(
          id,
          Object.keys(bundle.modules),
          getInitialModuleData,
          mapper
        );

        roots.push(tree);
      }

      // after trees we process links (this is mostly for uids)
      for (const bundle of Object.values(outputBundle)) {
        if (bundle.isAsset || bundle.facadeModuleId == null) continue; //only chunks

        addLinks(
          bundle.facadeModuleId,
          this.getModuleInfo.bind(this),
          links,
          mapper
        );
      }

      const tree = mergeTrees(roots);

      const { nodes, nodeIds } = mapper;
      removeCommonPrefix(nodes, nodeIds);

      for (const [id, uid] of Object.entries(nodeIds)) {
        if (nodes[uid]) {
          nodes[uid].id = id;
        } else {
          this.warn(`Could not find mapping for node ${id} ${uid}`);
        }
      }

      const data = { version: JSON_VERSION, tree, nodes, links };

      const fileContent = json
        ? JSON.stringify(data, null, 2)
        : await buildStats(
            title,
            data,
            template,
            extraStylePath,
            chartParameters
          );

      await mkdir(path.dirname(filename));
      await writeFile(filename, fileContent);

      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};
