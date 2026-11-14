import type { LoadReply, LoadRequest } from "./messages.js";

export const startWorker = (
  url: URL,
  request: LoadRequest,
  reply: (result: LoadReply) => void,
): Worker => {
  const worker = new Worker(url, { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<LoadReply>) => reply(event.data));
  worker.addEventListener("error", (event) => {
    event.preventDefault();
    reply({
      type: "error",
      message: "The report worker could not start. Reload the viewer and try again.",
    });
  });
  worker.postMessage(request, []);
  return worker;
};
