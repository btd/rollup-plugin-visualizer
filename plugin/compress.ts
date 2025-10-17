import * as zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

const gzipOptions = (options: zlib.ZlibOptions): zlib.ZlibOptions => ({
  level: 9,
  ...options,
});
const brotliOptions = (options: zlib.BrotliOptions, buffer: Buffer): zlib.BrotliOptions => ({
  params: {
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
  },
  ...options,
});

const createGzipCompressor = (options: zlib.ZlibOptions) => (buffer: Buffer) =>
  gzip(buffer, gzipOptions(options || {}));

export type SizeGetter = (code: string) => Promise<number>;

export const createGzipSizeGetter = (options: zlib.ZlibOptions): SizeGetter => {
  const compress = createGzipCompressor(options);
  return async (code: string) => {
    const data = await compress(Buffer.from(code, "utf-8"));
    return data.length;
  };
};

const createBrotliCompressor = (options: zlib.BrotliOptions) => (buffer: Buffer) =>
  brotliCompress(buffer, brotliOptions(options || {}, buffer));

export const createBrotliSizeGetter = (options: zlib.BrotliOptions): SizeGetter => {
  const compress = createBrotliCompressor(options);
  return async (code: string) => {
    const data = await compress(Buffer.from(code, "utf-8"));
    return data.length;
  };
};
