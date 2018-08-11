# Rollup Plugin Visualizer

[![NPM Version](https://img.shields.io/npm/v/rollup-plugin-visualizer.svg)](https://npmjs.org/package/rollup-plugin-visualizer)

Visualize and analyze your Rollup bundle to see which modules are taking up space.

## Screenshot

![Screenshot](https://github.com/btd/rollup-plugin-visualizer/blob/master/pic.png?raw=true)

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

This will output a file named `stats.html` in current directory. You can modify the name/location by passing a `filename` parameter into the constructor. You can also set a title by passing a `title` parameter.

```javascript
import visualizer from 'rollup-plugin-visualizer';

//...
plugins: [
  visualizer({
    filename: './statistics.html',
    title: 'My Bundle'
  })
],
//...
```

The file sizes reported are before any minification happens (if UglifyJS is being used, for example).
Minified module sizes can be calculated using the source maps.
To enable this mode, pass `{ sourcemap: true }`

```javascript
import visualizer from 'rollup-plugin-visualizer';

//...
plugins: [
  visualizer({
    sourcemap: true
  })
],
//...
```

You can use option `open` like `{ open: true }` to open generated file in default browser.

## Acknowledgements

Initially this plugin was based on [webpack-visualizer](http://chrisbateman.github.io/webpack-visualizer/), but in the end used only styles and layout. Thanks to the tons of people around internet for great examples of d3 usage.
