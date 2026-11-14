import { gzipSync } from "node:zlib";
import { encodeReport } from "../shared/share/codec.js";
import { fragmentFromGzip } from "../shared/share/transport.js";
import { createReportUrl, VIEWER_BASE_URL } from "../shared/share/url.js";

export const createShareLink = (template: string, title: string, data: unknown): string =>
  createReportUrl(
    VIEWER_BASE_URL,
    template,
    fragmentFromGzip(gzipSync(encodeReport({ title, data }))),
  );
