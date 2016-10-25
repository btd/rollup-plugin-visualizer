const rollupCommonJs = require('rollup-plugin-commonjs');
const rollupNodeResolve = require('rollup-plugin-node-resolve');

module.exports = {
    entry: './src/plugin1.js',
    format: 'iife',
    plugins: [
      rollupNodeResolve({
        jsnext: true,
        main: true
      }),
      rollupCommonJs({
        ignoreGlobal: true,
        include: 'node_modules/**'
      })
    ]
  };
