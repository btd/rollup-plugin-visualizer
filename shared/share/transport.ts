import { decodeReport, encodeReport, type ShareReport, type ShareReportInput } from "./codec.js";
import { ShareError, budget, invalid, resolveLimits, type ShareLimits } from "./limits.js";

const base64url = (bytes: Uint8Array): string => {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64url = (text: string, limits: ShareLimits): Uint8Array => {
  budget(Math.floor((text.length * 3) / 4), limits.maxCompressedBytes, "Compressed report");
  if (!text || text.length % 4 === 1 || !/^[A-Za-z0-9_-]+$/.test(text))
    return invalid("Invalid report payload.");
  let binary: string;
  try {
    binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return invalid("Invalid base64url payload.");
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  if (base64url(bytes) !== text) return invalid("Noncanonical base64url payload.");
  return bytes;
};

const abort = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new DOMException("Report processing cancelled.", "AbortError");
};

const transformGzip = async (
  bytes: Uint8Array,
  compress: boolean,
  limits: ShareLimits,
  signal?: AbortSignal,
): Promise<Uint8Array> => {
  abort(signal);
  if (typeof CompressionStream === "undefined" || typeof DecompressionStream === "undefined") {
    throw new ShareError(
      "unsupported-browser",
      "Native gzip support is required. Use a current desktop browser.",
    );
  }
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  const transform = compress ? new CompressionStream("gzip") : new DecompressionStream("gzip");
  const stream = source.pipeThrough(transform, { signal }),
    reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      abort(signal);
      total += value.length;
      budget(
        total,
        compress ? limits.maxCompressedBytes : limits.maxBinaryBytes,
        compress ? "Compressed report" : "Decompressed report",
      );
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof ShareError || signal?.aborted) throw error;
    return invalid(compress ? "Report compression failed." : "Invalid or truncated gzip report.");
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }
  return output;
};

export const fragmentFromGzip = (bytes: Uint8Array): string => `1.${base64url(bytes)}`;

export const encodeFragment = async (
  report: ShareReportInput,
  overrides: Partial<ShareLimits> = {},
  signal?: AbortSignal,
): Promise<string> => {
  abort(signal);
  const limits = resolveLimits(overrides);
  return fragmentFromGzip(await transformGzip(encodeReport(report, limits), true, limits, signal));
};

export const decodeFragment = async (
  fragment: string,
  overrides: Partial<ShareLimits> = {},
  signal?: AbortSignal,
): Promise<ShareReport> => {
  abort(signal);
  const text = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!text) return invalid("Missing report data.");
  if (text[0] !== "1")
    throw new ShareError("unsupported-version", "This report format requires a newer viewer.");
  if (text[1] !== ".") return invalid("Invalid report version separator.");
  const limits = resolveLimits(overrides),
    bytes = fromBase64url(text.slice(2), limits);
  return decodeReport(await transformGzip(bytes, false, limits, signal), limits);
};
