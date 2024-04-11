# Rollup Plugin Visualizer

[![NPM Version](https://img.shields.io/npm/v/rollup-plugin-visualizer.svg)](https://npmjs.org/package/rollup-plugin-visualizer) [![Node.js CI](https://github.com/btd/rollup-plugin-visualizer/actions/workflows/node.js.yml/badge.svg)](https://github.com/btd/rollup-plugin-visualizer/actions/workflows/node.js.yml)

Visualize and analyze your Rollup bundle to see which modules are taking up space.

## Screenshots

![pic](https://github.com/btd/rollup-plugin-visualizer/blob/master/pics/collage.png?raw=true)

## Installation

```sh
npm install --save-dev rollup-plugin-visualizer
```

or via yarn:

```sh
yarn add --dev rollup-plugin-visualizer
```

## Usage

Import

```javascript
// es
import { visualizer } from "rollup-plugin-visualizer";
// or
// cjs
const { visualizer } = require("rollup-plugin-visualizer");
```

Usage with rollup (rollup.config.js)

```js
module.exports = {
  plugins: [
    // put it the last one
    visualizer(),
  ],
};
```

Usage with vite (vite.config.js)

```js
module.exports = {
  plugins: [visualizer()],
};
```

Usage with vite TypeScript (vite.config.ts)

```ts
import { defineConfig, type PluginOption } from 'vite'
export default defineConfig({
  plugins: [visualizer() as PluginOption],
})
```

Usage with SvelteKit (vite.config.js)

```js
const config = {
  plugins: [
    visualizer({
      emitFile: true,
      filename: "stats.html",
    }),
  ],
};

export default config;
```

You will find 2/3 files in .svelte-kit/output dir named stats.html (see vite logs for file locations) . You can use this snippet as a starting point and change props/path.
You can also generate 3 json files and combine them to one with cli util.

## How to use generated files

Blue color used to to mark project-own files. This could be: written by you files or generated by build tool files.

Green color used to mark your dependencies.

Internally it just checks if file id prefix is `node_modules`.

All charts refresh layout on window resize.

### Sunburst

This circular hierarchical diagram can help you find huge pieces of code (aka that one huge thing). If you click on some arc it will increase its and all nested arcs size for better inspection.

### Treemap

This rectangular hierarchical diagram can help you find huge pieces. Just look on biggest rectangle. But also it can help you find modules included several times, they will have the same topology and relative size. If you click on rectangle it will increase in size for further inspection.

### Network

This diagram should help you answer for the question 'why it is included?'. After force layout stabilize all nodes, you can move it back and forth by dragging with your mouse. Gray circles are treeshaken out files.

In real life scenarios, sometimes you will see terribly connected diagrams. There is no 100% working solution for everyone, it is expected you topology will look 'terrible' and not hold on screen. To make it still visually inspectable, first remove all highly connected nodes that you see (typical examples: commonjsHelpers, tslib, react etc, basically if tooltip for the node is not hold on the screen - exclude this node), after layout stabilization you will see, your layout is not that terrible anymore and most of dependencies cluster together. Move layout to find pieces you looked for.

When you click on node it will highlight nodes that are listed in tooltip (the files that imports current node).

### Raw-data

This template produce JSON output with raw data. Normally it should be used with CLI from this plugin.

### List

Output yml file with all the data, could be good idea to commit this file to track file changes.

## Options

`filename` (string, default `stats.{ext depending template}`) - name of the file with diagram to generate

`title` (string, default `Rollup Visualizer`) - title tag value

`open` (boolean, default `false`) - Open generated file in default user agent

`template` (string, default `treemap`) - Which diagram type to use: `sunburst`, `treemap`, `network`, `raw-data`, `list`.

`gzipSize` (boolean, default `false`) - Collect gzip size from source code and display it at chart.

`brotliSize` (boolean, default `false`) - Collect brotli size from source code and display it at chart.

### Advanced options (touch only if you really need it):

`emitFile` (boolean, default `false`) - Use rollup's `emitFile` to generate file. Useful if you want to control all output in one place (via rollup output options). This also could be useful with svelte as it calls vite several times.

`sourcemap` (boolean, default `false`) - Use sourcemaps to calculate sizes (e.g. after UglifyJs or Terser). **Always add plugin as last option.**

`projectRoot` (string | RegExp, default `process.cwd()`) - This is some common root(s) path to your files. This is used to cut absolute files paths out.

`include` (Filter | Filter[], default `undefined`) - Filter for inclusion

`exclude` (Filter | Filter[], default `undefined`) - Filter for exclusion

`Filter` type is `{ bundle?: picomatchPattern, file?: picomatchPattern }`

**Note about `include` and `exclude`** - If options.include is omitted or has zero length, filter will return true by default. Otherwise, an ID must match one or more of the picomatch patterns, and must not match any of the options.exclude patterns. This entries will not be included in stats at all.

#### Include and Exclude

Include and exclude filters uses glob matchers with picomatch. In UI you can do such combinations (both exclude and include):
* Filter bundle and file in one string
  * `translation-*.js:*/**/index.js` - this selects all bundles that matches `translation-*.js` and all the files by all paths that name is `index.js`. `:` is separator and required only when bundle search used.
  * Format for this kind of filter is `BUNDLE_GLOB:FILE_GLOB`
* Filter bundle in one string
  * This is special case of bundle+file filter, you need to omit `FILE_GLOB` part (empty string) 
* Filter file in one string
  * **This is DEFAULT search option**
  * `*/**/index.js` - select all files that name is index.js   

## CLI

This plugin provides cli util `rollup-plugin-visualizer`. Add `--help` to check actual options. It can be used like:

```sh
rollup-plugin-visualizer [OPTIONS] stat1.json stat2.json ../stat3.json
```

This can be useful in case you have different config files in the same project and you want to display all of them in the same chart.

## Build plugin

For development if you need to build plugin, just exec:

```js
npm run build
```

## Disclaimer about generated files

Generated html files do not and never will contain your source code (contents of files). They can contain only js/html/css code required to build chart (plugin code) and statistical information about your source code.

This statistical information can contain:

- size of files included in bundle
- size of files included in source map
- file's paths
- files hierarchy (fs tree for your files)

## Upgrades

See CHANGELOG.md.

## Versioning

* Plugin backend (one appears in configs) are strictly follows SemVer
* Plugin frontend (generated file):
  * `network`, `treemap`, `sunburst` can change does not matter of version (colors, texts, visual structure etc)
  * `raw-data` format follows own `version` property
  * `list` follows semver
