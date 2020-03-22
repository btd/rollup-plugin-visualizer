"use strict";

const zlib = require("zlib");
const { promisify } = require("util");

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress || (() => {}));

const gzipOptions = (options) => ({ level: 9, ...options });
const brotliOptions = zlib.brotliCompress
  ? (options, buffer) => ({
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]:
          zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
      ...options,
    })
  : () => ({});

const createGzipCompressor = (options) => (buffer) =>
  gzip(buffer, gzipOptions(options || {}));

const createGzipSizeGetter = (options) => {
  const compress = createGzipCompressor(options);
  return async (code) => {
    const data = await compress(Buffer.from(code, "utf-8"));
    return data.length;
  };
};

const createBrotliCompressor = (options) => (buffer) =>
  brotliCompress(buffer, brotliOptions(options || {}, buffer));

const createBrotliSizeGetter = zlib.brotliCompress
  ? (options) => {
      const compress = createBrotliCompressor(options);
      return async (code) => {
        const data = await compress(Buffer.from(code, "utf-8"));
        return data.length;
      };
    }
  : () => () => Promise.resolve(undefined);

module.exports = { createGzipSizeGetter, createBrotliSizeGetter };
