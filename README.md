# Rollup Plugin Visualizer

[![NPM Version](https://img.shields.io/npm/v/rollup-plugin-visualizer.svg)](https://npmjs.org/package/rollup-plugin-visualizer) [![Travis CI build status](https://img.shields.io/travis/com/btd/rollup-plugin-visualizer.svg)](https://travis-ci.com/btd/rollup-plugin-visualizer)

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

```javascript
import visualizer from 'rollup-plugin-visualizer';

//...
plugins: [
  visualizer()
],
//...
```

## Options

`filename` (string, default `stats.html`) - name of the file with diagram to generate

`title` (string, default `Rollup Visualizer`) - title tag value

`sourcemap` (boolean, default `false`) - Use sourcemaps to calculate sizes (e.g. after UglifyJs or Terser)

`open` (boolean, default `false`) - Open generated file in default user agent

`template` (string, default `treemap`) - Which digram type to use: `sunburst`, `treemap`, `network` (very early stage, feedback welcomed)

`json` (boolean, default `false`) - Product portable json file that can be used with plugin CLI util to generate graph from several json files. Every UI property ignored in this case.

`gzipSize` (boolean, default `false`) - Collect gzip size from source code and display it at chart

`brotliSize` (boolean, default `false`) - Collect brolti size from source code and display it at chart. Only if current node version supports it

## CLI

This plugin provides cli util `rollup-plugin-visualizer`. Add `--help` to check actual options. It can be used like:

```sh
rollup-plugin-visualizer [OPTIONS] stat1.json stat2.json ../stat3.json
```

This can be usefull in case you have different config files in the same project and you want to display all of them in the same chart.

## Build plugin

For development if you need to build plugin, just exec:

```js
yarn run build
```

## Disclaimer about generated files

Generated html files do not and never will contain your source code (contents of files). They can contain only js/html/css code required to build chart (plugin code) and statistical information about your source code.

This statistical information can contain:

- size of files included in bundle
- size of files included in source map
- file's path
- files hierarchy (fs tree for your files)

## Upgrades

See CHANGELOG.md.

## Acknowledgements

Initially this plugin was based on `webpack-visualizer`, but in the end used only styles and layout. Thanks to the tons of people around internet for great examples of d3 usage. Also i would like to thank you Mike Bostock for awesome D3, and tons of examples.
