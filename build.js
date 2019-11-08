/* eslint-disable global-require */
"use strict";

const { rollup } = require("rollup");

const commonJs = require("rollup-plugin-commonjs");
const postcss = require("rollup-plugin-postcss");
const resolve = require("rollup-plugin-node-resolve");
const postcssUrl = require("postcss-url");

const TEMPLATE = ["sunburst", "treemap", "circlepacking", "network"];

let args = require("yargs")
  .option("all", {
    describe: "Build all templates",
    boolean: true
  })
  .option("dev", { describe: "Build stats file(s)", boolean: true })
  .option("open", { describe: "Open browser with stat files", boolean: true })
  .option("build-all", { describe: "Build combined bundle", boolean: true });

for (const t of TEMPLATE) {
  args = args.option(t, {
    describe: `Build ${t} template`,
    boolean: true
  });
}

args = args.help();

const argv = args.argv;

const templatesToBuild = [];
if (argv.all) {
  templatesToBuild.push(...TEMPLATE);
} else {
  for (const t of TEMPLATE) {
    if (argv[t]) {
      templatesToBuild.push(t);
    }
  }
}

const isDev = argv.dev;
const open = argv.open;

const COMMON_PLUGINS = [
  resolve(),
  commonJs({
    ignoreGlobal: true,
    include: "node_modules/**"
  }),
  postcss({
    extract: true,
    plugins: [
      postcssUrl({
        url: "inline"
      })
    ]
  })
];

const runBuild = async (template, dev) => {
  const inputOptions = {
    input: `./src/script-${template}.js`,
    plugins: [
      ...COMMON_PLUGINS,
      dev
        ? require("./")({
            open,
            title: `test ${template}`,
            filename: `stats.${template}.html`,
            template
          })
        : null
    ].filter(Boolean),
    onwarn: warning => {
      const { code } = warning;
      if (
        code === "CIRCULAR_DEPENDENCY" ||
        code === "CIRCULAR" ||
        code === "THIS_IS_UNDEFINED"
      ) {
        return;
      }
      // eslint-disable-next-line no-console
      console.warn("WARNING: ", warning.toString());
    }
  };
  const outputOptions = {
    format: "iife",
    dir: "./lib/"
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildCombined = async template => {
  const input = {};
  for (const t of TEMPLATE) {
    input[t] = `./src/script-${t}.js`;
  }
  const inputOptions = {
    input,
    plugins: [
      ...COMMON_PLUGINS,
      require("./")({
        open,
        title: `test ${template}`,
        filename: `stats.${template}.html`,
        template
      })
    ],
    onwarn: warning => {
      const { code } = warning;
      if (
        code === "CIRCULAR_DEPENDENCY" ||
        code === "CIRCULAR" ||
        code === "THIS_IS_UNDEFINED"
      ) {
        return;
      }
      // eslint-disable-next-line no-console
      console.warn("WARNING: ", warning.toString());
    }
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/"
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

if (argv.buildAll) {
  Promise.all(TEMPLATE.map(t => runBuild(t))).then(() =>
    Promise.all(templatesToBuild.map(t => runBuildCombined(t)))
  );
} else {
  for (const t of templatesToBuild) {
    runBuild(t).then(() => {
      if (isDev) {
        runBuild(t, true);
      }
    });
  }
}
