# Rollup Plugin Visualizer

[![NPM Version](https://img.shields.io/npm/v/rollup-plugin-visualizer.svg)](https://npmjs.org/package/rollup-plugin-visualizer) [![Travis CI build status](https://img.shields.io/travis/com/btd/rollup-plugin-visualizer.svg)](https://travis-ci.com/btd/rollup-plugin-visualizer)

Visualize and analyze your Rollup bundle to see which modules are taking up space.

## Screenshots

![pic](https://github.com/btd/rollup-plugin-visualizer/blob/master/pics/collage.jpg?raw=true)

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

`sourcemap` (boolean, default `false`) - Use sourcemaps to calculate sizes (e.g. after UglifyJs) 

`open` (boolean, default `false`) - Open generated file in default user agent

`template` (string, default `sunburst`) - Which digram type to use: `sunburst`, `treemap`, `circlepacking`, `network` (very early stage, feedback welcomed)

`bundlesRelative` (boolean, default `false`) - Combine all bundles to one diagram

## Build plugin

For development if you need to build plugin, just exec:
```js
yarn run build
```

## Disclaimer about generated files

Generated files does not and never will be contain your source code (contents of files). They can contains only js/html/css code required to build chart (plugin code) and statistical information about your source code.
This statistical information can contain:
* byte size of files included in bundled
* size of files included in source map
* file's path
* files hierarchy (fs tree for your files)

## Upgrades

v1 -> v2: For v2 was a lot of internal changes, but external interface has not changed. 

## Acknowledgements

Initially this plugin was based on `webpack-visualizer`, but in the end used only styles and layout. Thanks to the tons of people around internet for great examples of d3 usage. Also i would like to thank you Mike Bostock for awesome D3, and tons of examples.
