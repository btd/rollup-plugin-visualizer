import type { ShareReport } from "../../shared/share/codec.js";

export type LoadRequest = { type: "encode"; file: File } | { type: "decode"; fragment: string };
export type LoadReply =
  | { type: "progress"; message: string }
  | { type: "encoded"; fragment: string }
  | { type: "decoded"; report: ShareReport }
  | { type: "error"; message: string };
