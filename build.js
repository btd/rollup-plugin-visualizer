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
    boolean: true,
  })
  .option("open", { describe: "Open browser with stat files", boolean: true })
  .option("json", { describe: "Generate json", boolean: true })
  .option("e2e", { describe: "Exec e2e test", boolean: true })
  .option("sourcemap", { describe: "Enable sourcemap", boolean: true })
  .option("terser", { describe: "Enable terser", boolean: true })
  .option("gzip", { describe: "Enable gzip", boolean: true })
  .option("brotli", { describe: "Enable brotli", boolean: true })
  .option("test", { describe: "Run tests", boolean: true })
  .option("dev", { describe: "Run dev build", boolean: true });

for (const t of TEMPLATE) {
  args = args.option(t, {
    describe: `Build ${t} template`,
    boolean: true,
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

const simpleOptions = {
  open: argv.open,
  json: argv.json,
  sourcemap: argv.sourcemap,
  gzipSize: argv.gzip,
  brotliSize: argv.brotli,
};

const COMMON_PLUGINS = () =>
  [
    resolve(),
    commonJs({
      ignoreGlobal: true,
      include: "node_modules/**",
    }),
    postcss({
      extract: true,
      plugins: [
        postcssUrl({
          url: "inline",
        }),
      ],
    }),
    argv.terser ? terser() : null,
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

const inputPath = (template) =>
  template === "treemap"
    ? "./src/treemap/index.js"
    : `./src/script-${template}.js`;

const runBuild = async (template) => {
  const inputOptions = {
    input: inputPath(template),
    plugins: [...COMMON_PLUGINS()],
    onwarn,
  };
  const outputOptions = {
    format: "iife",
    dir: "./lib/",
    name: "drawChart",
    sourcemap: argv.sourcemap,
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildDev = async (template) => {
  const input = {};
  for (const t of TEMPLATE) {
    input[t] = inputPath(t);
  }
  const inputOptions = {
    input,
    plugins: [
      ...COMMON_PLUGINS(),
      require("./")({
        title: `test ${template}`,
        filename: `stats.${template}${fileExt}`,
        template,
        ...simpleOptions,
      }),
    ],
    onwarn,
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/",
    sourcemap: argv.sourcemap,
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildTest_e2e = async (template = "treemap") => {
  const input = {
    input: "./test/e2e/input.js",
    input2: "./test/e2e/input2.js",
  };

  const inputOptions = {
    external: ["jquery"],
    input,
    plugins: [
      ...COMMON_PLUGINS(),
      require("./")({
        title: "test e2e",
        filename: `stats.e2e${fileExt}`,
        template,
        ...simpleOptions,
      }),
    ],
    onwarn,
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/",
    sourcemap: argv.sourcemap,
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildTest_gh59 = async (template) => {
  const input = {
    index: "test/gh59/src/index",
    "components/index": "test/gh59/src/components/index",
    "components/A": "test/gh59/src/components/A",
    "components/B": "test/gh59/src/components/B",
  };

  const inputOptions = {
    input,
    plugins: [
      require("./")({
        title: "test gh59",
        filename: `stats.gh59${fileExt}`,
        template,
        ...simpleOptions,
      }),
    ],
    onwarn,
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/",
    sourcemap: argv.sourcemap,
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildTest_gh69 = async (template) => {
  const input = "test/gh69/main.js";

  const inputOptions = {
    input,
    plugins: [
      require("./")({
        title: "test gh69",
        filename: `stats.gh69${fileExt}`,
        template,
        ...simpleOptions,
      }),
    ],
    onwarn,
  };
  const outputOptions = {
    format: "es",
    dir: "./temp/",
    sourcemap: argv.sourcemap,
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const buildAll = (action) =>
  Promise.all(templatesToBuild.map((t) => action(t)));

const run = async () => {
  await Promise.all(TEMPLATE.map((t) => runBuild(t)));
  if (argv.dev) {
    await buildAll(runBuildDev);
  }
  if (argv.e2e) {
    await buildAll(runBuildTest_e2e);
  }
  if (argv.test) {
    await buildAll(runBuildTest_gh59);
    await buildAll(runBuildTest_gh69);
  }
};

run();
