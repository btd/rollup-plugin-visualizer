import { decodeFragment, encodeFragment } from "../../shared/share/transport.js";
import { DEFAULT_SHARE_LIMITS, ShareError, budget } from "../../shared/share/limits.js";
import { parseReportJson } from "../../shared/share/validation.js";
import type { LoadReply, LoadRequest } from "./messages.js";

interface WorkerScope {
  addEventListener(type: "message", listener: (event: MessageEvent<LoadRequest>) => void): void;
  postMessage(message: LoadReply, transfer: Transferable[]): void;
}
const scope = globalThis as unknown as WorkerScope;
scope.addEventListener("message", async ({ data }) => {
  try {
    if (data.type === "encode" && data.file instanceof File) {
      budget(data.file.size, DEFAULT_SHARE_LIMITS.maxFileBytes, "Raw-data file");
      scope.postMessage({ type: "progress", message: "Reading and validating report…" }, []);
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(await data.file.arrayBuffer());
      } catch {
        throw new ShareError("invalid-report", "The report must be UTF-8 JSON.");
      }
      const report = parseReportJson(source);
      scope.postMessage({ type: "progress", message: "Generating report link…" }, []);
      scope.postMessage({ type: "encoded", fragment: await encodeFragment({ data: report }) }, []);
    } else if (data.type === "decode" && typeof data.fragment === "string") {
      scope.postMessage({ type: "decoded", report: await decodeFragment(data.fragment) }, []);
    } else throw new ShareError("invalid-report", "Invalid report request.");
  } catch (error) {
    scope.postMessage(
      {
        type: "error",
        message: error instanceof ShareError ? error.message : "Could not process this report.",
      },
      [],
    );
  }
});
