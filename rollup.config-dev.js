"use strict";

const baseConfig = require("./rollup.config");
const plugin = require("./plugin");
const path = require("path");

module.exports = baseConfig.map((config, index) => {
  config.plugins.push(plugin({
    open: true,
    filename: `stats.${index}.html`,
    template: getTemplateType(config)
  }));
  return config;
});

function getTemplateType({ input }) {
  const filename = path.basename(input, path.extname(input));
  const [, templateType] = filename.split("-");
  return templateType;
}
