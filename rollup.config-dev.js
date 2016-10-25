var config = require('./rollup.config');

const plugin = require('./plugin');

let copy = Object.assign({}, config);
copy.plugins = [].concat(copy.plugins, [plugin]);
module.exports = copy;
