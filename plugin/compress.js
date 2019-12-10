"use strict";

const zlib = require("zlib");
const { promisify } = require("util");

const gzip = promisify(zlib.gzip);

const gzipOptions = options => ({ level: 9, ...options });

const createGzipCompressor = options => buffer =>
  gzip(buffer, gzipOptions(options || {}));

const createGzipSizeGetter = options => {
  const compress = createGzipCompressor(options);
  return async code => {
    const data = await compress(Buffer.from(code, "utf-8"));
    return data.length;
  };
};

module.exports = { createGzipSizeGetter };
