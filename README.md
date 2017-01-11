# Rollup Plugin Visualizer
Visualize and analyze your Rollup bundle to see which modules are taking up space.

## Screenshot

![Screenshot](https://github.com/btd/rollup-plugin-visualizer/blob/master/pic.png?raw=true)

## Plugin Usage

```
npm i -D rollup-plugin-visualizer
```

```javascript
var Visualizer = require('rollup-plugin-visualizer');

//...
plugins: [Visualizer()],
//...
```
This will output a file named `stats.html` in current directory. You can modify the name/location by passing a `filename` parameter into the constructor.

```javascript
var Visualizer = require('rollup-plugin-visualizer');

//...
plugins: [Visualizer({
  filename: './statistics.html'
})],
//...
```

The file sizes reported are before any minification happens (if UglifyJS is being used, for example).
Minified module sizes can be calculated using the source maps.
To enable this mode, pass `{ sourcemap: true }`

```javascript
var Visualizer = require('rollup-plugin-visualizer');

//...
plugins: [Visualizer({
  sourcemap: true
})],
//...
```
## Acknowledges

Initially this plugin is based on [webpack-visualizer](http://chrisbateman.github.io/webpack-visualizer/), but at the end rest only styles and layout. Thanks tons of people around internet for great examples of d3 usage.
