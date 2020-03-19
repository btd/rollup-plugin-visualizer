"use strict";

const fs = require("fs").promises;
const path = require("path");

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
const getSourcemapModules = require("./sourcemap");

const { createGzipSizeGetter } = require("./compress");

const pkg = require("../package.json");

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

  const chartParameters = opts.chartParameters || {};

  const gzipSize = !!opts.gzipSize;
  const additionalFilesInfo = new Map();
  const gzipSizeGetter = gzipSize
    ? createGzipSizeGetter(typeof opts.gzipSize === "object" ? gzipSize : {})
    : null;

  return {
    name: "visualizer",

    async transform(code, id) {
      const info = {};
      if (gzipSize) {
        info.gzipLength = await gzipSizeGetter(code);
      }
      additionalFilesInfo.set(id, info);
      return null;
    },

    async generateBundle(outputOptions, outputBundle) {
      if (opts.sourcemap && !outputOptions.sourcemap) {
        this.warn(WARN_SOURCEMAP_DISABLED);
      }

      const roots = [];
      const mapper = new ModuleMapper();
      const links = [];

      // collect trees
      for (const [id, bundle] of Object.entries(outputBundle)) {
        if (bundle.isAsset) continue; //only chunks

        let tree;

        if (opts.sourcemap) {
          if (!bundle.map) {
            this.warn(WARN_SOURCEMAP_MISSING(id));
          }

          const modules = await getSourcemapModules(
            id,
            bundle,
            outputOptions.dir || path.dirname(outputOptions.file)
          );

          tree = buildTree(id, Object.entries(modules), mapper);
        } else {
          tree = buildTree(id, Object.entries(bundle.modules), mapper);
        }

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

      const { nodes, nodeIds } = mapper;
      for (const [id, uid] of Object.entries(nodeIds)) {
        if (nodes[uid]) {
          const newInfo = additionalFilesInfo.get(id) || {};
          if (gzipSize && nodes[uid].renderedLength === 0) {
            newInfo.gzipLength = 0;
          }
          nodes[uid] = {
            ...nodes[uid],
            ...newInfo
          };
        } else {
          this.warn(`Could not find mapping for node ${id} ${uid}`);
        }
      }

      removeCommonPrefix(nodes, nodeIds);

      for (const [id, uid] of Object.entries(nodeIds)) {
        if (nodes[uid]) {
          nodes[uid].id = id;
        } else {
          this.warn(`Could not find mapping for node ${id} ${uid}`);
        }
      }

      const tree = mergeTrees(roots);

      const data = {
        version: JSON_VERSION,
        tree,
        nodes,
        links,
        env: {
          rollup: this.meta.rollupVersion,
          [pkg.name]: pkg.version
        },
        options: {
          gzip: gzipSize
        }
      };

      const fileContent = json
        ? JSON.stringify(data, null, 2)
        : await buildStats({
            title,
            data,
            template,
            chartParameters
          });

      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, fileContent);

      if (open) {
        return opn(filename, openOptions);
      }
    }
  };
};
