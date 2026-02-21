import commonJs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import postcss from "rollup-plugin-postcss";
import postcssUrl from "postcss-url";

const HTML_TEMPLATE = ["treemap", "treemap-3d", "sunburst", "network", "flamegraph"];

/** @type {import('rollup').RollupOptions} */
export default HTML_TEMPLATE.map((templateType) => ({
  input: `./src/${templateType}/index.tsx`,

  plugins: [
    typescript({ 
      tsconfig: "./src/tsconfig.json", 
      noEmitOnError: false,
    }),
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
  ],

  output: {
    format: "iife",
    file: `./dist/lib/${templateType}.js`,
    name: "drawChart",
    exports: "named",
  },
}));
