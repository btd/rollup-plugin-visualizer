/* eslint-disable global-require */
"use strict";

const { rollup } = require("rollup");

const commonJs = require("@rollup/plugin-commonjs");
const resolve = require("@rollup/plugin-node-resolve").default;
const typescript = require("@rollup/plugin-typescript");
const postcss = require("rollup-plugin-postcss");
const postcssUrl = require("postcss-url");

const HTML_TEMPLATE = ["treemap", "sunburst", "network"];
const PLAIN_TEMPLATE = ["raw-data", "list"];
const ALL_TEMPLATE = [...HTML_TEMPLATE, ...PLAIN_TEMPLATE];

let args = require("yargs")
  .strict()
  .option("all", {
    describe: "Build all templates",
    boolean: true,
  })
  .option("open", { describe: "Open browser with stat files", boolean: true })
  .option("e2e", { describe: "Exec e2e test", boolean: true })
  .option("sourcemap", { describe: "Enable sourcemap", boolean: true })
  .option("gzip", { describe: "Enable gzip", boolean: true })
  .option("brotli", { describe: "Enable brotli", boolean: true })
  .option("test", { describe: "Run tests", boolean: true })
  .option("dev", { describe: "Run dev build", boolean: true });

const chooseExt = (template) => {
  if (template === "raw-data") return ".json";

  if (template === "list") return ".yml";

  return ".html";
};

for (const t of ALL_TEMPLATE) {
  args = args.option(t, {
    describe: `Build ${t} template`,
    boolean: true,
  });
}

args = args.help();

const argv = args.argv;

const templatesToBuild = [];
if (argv.all) {
  templatesToBuild.push(...ALL_TEMPLATE);
} else {
  for (const t of ALL_TEMPLATE) {
    if (argv[t]) {
      templatesToBuild.push(t);
    }
  }
}

console.log("Building templates", templatesToBuild);

const simpleOptions = {
  open: argv.open,
  sourcemap: argv.sourcemap,
  gzipSize: argv.gzip,
  brotliSize: argv.brotli,
};

const COMMON_PLUGINS = () =>
  [
    typescript({ tsconfig: "./src/tsconfig.json", noEmitOnError: true }),
    resolve({ mainFields: ["module", "main"] }),
    commonJs({
      ignoreGlobal: true,
      include: ["node_modules/**"],
    }),
    postcss({
      extract: true,
      plugins: [
        postcssUrl({
          url: "inline",
        }),
      ],
    }),
  ].filter(Boolean);

const onwarn = (warning, warn) => {
  const { code } = warning;
  if (code === "CIRCULAR_DEPENDENCY" || code === "CIRCULAR" || code === "THIS_IS_UNDEFINED") {
    return;
  }
  warn(warning);
};

const inputPath = (template) => `./src/${template}/index.tsx`;

const runBuild = async (template) => {
  const inputOptions = {
    input: inputPath(template),
    plugins: [...COMMON_PLUGINS(template)],
    onwarn,
  };
  const outputOptions = {
    format: "iife",
    file: `./dist/lib/${template}.js`,
    name: "drawChart",
    exports: "named",
    sourcemap: argv.sourcemap,
  };

  const bundle = await rollup(inputOptions);

  await bundle.write(outputOptions);
};

const runBuildDev = async (template) => {
  const input = {};
  for (const t of HTML_TEMPLATE) {
    input[t] = inputPath(t);
  }
  const inputOptions = {
    input,
    plugins: [
      ...COMMON_PLUGINS(),
      require(".").default({
        title: `test ${template}`,
        filename: `stats.${template}${chooseExt(template)}`,
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
      require(".").default({
        title: "test e2e",
        filename: `stats.e2e${chooseExt(template)}`,
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
      require(".").default({
        title: "test gh59",
        filename: `stats.gh59${chooseExt(template)}`,
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
      require(".").default({
        title: "test gh69",
        filename: `stats.gh69${chooseExt(template)}`,
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

const runBuildTest_gh93 = async (template) => {
  const input = "test/gh93/main.js";

  const inputOptions = {
    input,
    plugins: [
      {
        name: "pseudo-alias",
        resolveId(source) {
          if (source === "virtual-id") {
            return source;
          }
          return null;
        },
        load(id) {
          if (id === "virtual-id") {
            return 'console.log("virtual-id")';
          }
          return null;
        },
        async transform(code, id) {
          this.emitFile({
            type: "chunk",
            id: "virtual-id", // specifically id without \0000 as by rollup naming convention
          });
          return { code };
        },
      },
      require(".").default({
        title: "test gh93",
        filename: `stats.gh93${chooseExt(template)}`,
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

const runBuildTest_filter = async (template) => {
  const input = {
    input: "./test/e2e/input.js",
    input2: "./test/e2e/input2.js",
  };

  const inputOptions = {
    external: ["jquery"],
    input,
    plugins: [
      ...COMMON_PLUGINS(),
      require(".").default({
        title: "test filter",
        filename: `stats.filter${chooseExt(template)}`,
        template,
        exclude: ['**/node_modules/**'],
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

const buildAll = (action) => Promise.all(templatesToBuild.map((t) => action(t)));

const run = async () => {
  await Promise.all(HTML_TEMPLATE.map((t) => runBuild(t)));
  if (argv.dev) {
    await buildAll(runBuildDev);
  }
  if (argv.e2e) {
    await buildAll(runBuildTest_e2e);
  }
  if (argv.test) {
    await buildAll(runBuildTest_gh59);
    await buildAll(runBuildTest_gh69);
    await buildAll(runBuildTest_gh93);
    await buildAll(runBuildTest_filter)
  }
};

run();
