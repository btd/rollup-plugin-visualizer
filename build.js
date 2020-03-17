/* eslint-disable global-require */
"use strict";

const { rollup } = require("rollup");

const commonJs = require("@rollup/plugin-commonjs");
const postcss = require("rollup-plugin-postcss");
const resolve = require("@rollup/plugin-node-resolve");
const { terser } = require("rollup-plugin-terser");
const postcssUrl = require("postcss-url");

const TEMPLATE = require("./plugin/template-types");

let args = require("yargs")
  .strict()
  .option("all", {
    describe: "Build all templates",
    boolean: true
  })
  .option("open", { describe: "Open browser with stat files", boolean: true })
  .option("json", { describe: "Generate json", boolean: true })
  .option("e2e", { describe: "Exec e2e test", boolean: true })
  .option("sourcemap", { describe: "Enable sourcemap", boolean: true })
  .option("terser", { describe: "Enable terser", boolean: true })
  .option("gzip", { describe: "Enable gzip", boolean: true })
  .option("test", { describe: "Run tests", boolean: true });

for (const t of TEMPLATE) {
  args = args.option(t, {
    describe: `Build ${t} template`,
    boolean: true
  });
}

args = args.help();

const argv = args.argv;

const fileExt = argv.json ? ".json" : ".html";

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

const open = argv.open;

const COMMON_PLUGINS = () =>
  [
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
    }),
    argv.terser ? terser() : null
  ].filter(Boolean);

const onwarn = (warning, warn) => {
  const { code } = warning;
  if (
    code === "CIRCULAR_DEPENDENCY" ||
    code === "CIRCULAR" ||
    code === "THIS_IS_UNDEFINED"
  ) {
    return;
  }
  warn(warning);
};

const runBuild = async template => {
  const inputOptions = {
    input: `./src/script-${template}.js`,
    plugins: [...COMMON_PLUGINS()],
    onwarn
  };
  const outputOptions = {
    format: "iife",
    dir: "./lib/",
    name: "drawChart",
    sourcemap: argv.sourcemap
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildDev = async template => {
  const input = {};
  for (const t of TEMPLATE) {
    input[t] = `./src/script-${t}.js`;
  }
  const inputOptions = {
    input,
    plugins: [
      ...COMMON_PLUGINS(),
      require("./")({
        open,
        title: `test ${template}`,
        filename: `stats.${template}${fileExt}`,
        json: argv.json,
        template,
        sourcemap: argv.sourcemap,
        gzipSize: argv.gzip
      })
    ],
    onwarn
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/",
    sourcemap: argv.sourcemap
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildTest_e2e = async () => {
  const input = {
    input: "./test/e2e/input.js",
    input2: "./test/e2e/input2.js"
  };

  const inputOptions = {
    external: ["jquery"],
    input,
    plugins: [
      ...COMMON_PLUGINS(),
      require("./")({
        open,
        title: "test e2e",
        filename: `stats.e2e${fileExt}`,
        json: argv.json,
        template: "treemap",
        sourcemap: argv.sourcemap,
        gzipSize: argv.gzip
      })
    ],
    onwarn
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/",
    sourcemap: argv.sourcemap
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildTest_gh59 = async () => {
  const input = {
    index: "test/gh59/src/index",
    "components/index": "test/gh59/src/components/index",
    "components/A": "test/gh59/src/components/A",
    "components/B": "test/gh59/src/components/B"
  };

  const inputOptions = {
    input,
    plugins: [
      require("./")({
        open,
        title: "test gh59",
        filename: `stats.gh59${fileExt}`,
        json: argv.json,
        template: "treemap",
        sourcemap: argv.sourcemap,
        gzipSize: argv.gzip
      })
    ],
    onwarn
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/",
    sourcemap: argv.sourcemap
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const run = async () => {
  await Promise.all(TEMPLATE.map(t => runBuild(t)));
  await Promise.all(templatesToBuild.map(t => runBuildDev(t)));
  if (argv.e2e) {
    await runBuildTest_e2e();
  }
  if (argv.test) {
    await runBuildTest_gh59();
  }
};

run();
