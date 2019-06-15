"use strict";

const { Readable } = require("stream");
const path = require("path");

const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");

const del = require("del");
const sass = require("gulp-sass");

const rollup = require("rollup");
const rollupNodeResolve = require("rollup-plugin-node-resolve");
const rollupCommonJs = require("rollup-plugin-commonjs");

const argv = require("yargs").argv;

const isDev = !!argv.dev;

const plugin = require("./plugin");

const gulp = require("gulp");

const outputDir = path.join(".", "lib");
const inputDir = path.join(".", "src");

const defineTemplateBuild = templateType => {
  const stylePath = path.join(inputDir, `style-${templateType}.scss`);
  const outputStylePath = path.join(outputDir, `style-${templateType}.css`);

  gulp.task(`${templateType}:style:clean`, () => del(outputStylePath));
  gulp.task(`${templateType}:style:build`, () =>
    gulp
      .src(stylePath)
      .pipe(sass())
      .pipe(gulp.dest(outputDir))
  );

  const outputScriptName = `main-${templateType}.js`;
  const scriptPath = path.join(inputDir, `script-${templateType}.js`);
  const outputScriptPath = path.join(outputDir, outputScriptName);

  gulp.task(`${templateType}:script:clean`, () => del(outputScriptPath));
  gulp.task(`${templateType}:script:build`, () => {
    const options = {
      input: scriptPath,
      output: {
        format: "iife"
      },
      plugins: [
        rollupNodeResolve({
          mainFields: ["module", "jsnext", "main"]
        }),
        rollupCommonJs({
          ignoreGlobal: true
        })
      ]
    };

    if (isDev) {
      options.plugins.push(plugin({ template: templateType, filename: `${templateType}.html` }));
    }

    const stream = new Readable();
    stream._read = function() {};

    rollup
      .rollup(options)
      .then(bundle => {
        stream.emit("bundle", bundle);

        return bundle.generate(options);
      })
      .then(({ output }) => {
        for (const { code } of output) {
          stream.push(code);
        }

        stream.push(null);
      })
      .catch(reason => {
        setImmediate(() => {
          stream.emit("error", reason);
        });
      });

    return stream
      .pipe(source(outputScriptName))
      .pipe(buffer())
      .pipe(gulp.dest(outputDir));
  });

  gulp.task(
    `${templateType}:build`,
    gulp.parallel(`${templateType}:script:build`, `${templateType}:style:build`)
  );

  gulp.task(
    `${templateType}:clean`,
    gulp.parallel(`${templateType}:script:clean`, `${templateType}:style:clean`)
  );
};

const templates = ["sunburst", "treemap", "circlepacking"];

for (const template of templates) {
  defineTemplateBuild(template);
}

gulp.task("build", gulp.parallel(templates.map(t => `${t}:build`)));
gulp.task("clean", gulp.parallel(templates.map(t => `${t}:clean`)));

gulp.task("default", gulp.series("build"));
