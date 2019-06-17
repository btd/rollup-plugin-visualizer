"use strict";

const baseConfig = require("./rollup.config");
const plugin = require("./plugin");

module.exports = baseConfig.map((options, index) => {
  options.plugins.push(plugin({
    open: true,
    filename: `stats.${index}.html`,
    template: options.$template
  }));
  return options;
});
