"use strict";

const baseConfig = require("./rollup.config");
const plugin = require("./plugin");
const path = require("path");

module.exports = baseConfig.map(config => {
  const templateType = getTemplateType(config);
  config.plugins.push(
    plugin({
      open: true,
      title: `test ${templateType}`,
      filename: `stats.${templateType}.html`,
      template: templateType
    })
  );
  return config;
});

function getTemplateType({ input }) {
  const filename = path.basename(input, path.extname(input));
  const [, templateType] = filename.split("-");
  return templateType;
}
