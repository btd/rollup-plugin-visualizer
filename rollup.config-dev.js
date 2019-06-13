"use strict";

const plugin = require("./plugin");
const config = require("./rollup.config");

config.plugins.push(plugin({ open: true, filename: "sunburst.html", template: "sunburst" }));
config.plugins.push(plugin({ open: true, filename: "treemap.html", template: "treemap" }));
config.plugins.push(
  plugin({ open: true, filename: "circlepacking.html", template: "circlepacking" })
);

module.exports = config;
