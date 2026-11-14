import type { VisualizerData } from "../../shared/types.js";
import { startWorker } from "./worker.js";

declare global {
  var drawChart:
    | { default(parent: Element, data: VisualizerData, width: number, height: number): void }
    | undefined;
}
const main = document.querySelector<HTMLElement>("main")!;
let worker: Worker | undefined,
  generation = 0,
  current: VisualizerData | undefined;

const message = (text: string, error = false): void => {
  main.dataset.viewerState = error ? "error" : "loading";
  main.classList.add("viewer-message");
  main.setAttribute("role", error ? "alert" : "status");
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  const home = document.createElement("a");
  home.href = "../";
  home.textContent = "Choose a raw-data file";
  main.replaceChildren(paragraph, home);
};
const draw = (): void => {
  if (!current) return;
  try {
    if (!globalThis.drawChart) throw new Error("Missing chart renderer");
    main.classList.remove("viewer-message");
    main.removeAttribute("role");
    globalThis.drawChart.default(main, current, window.innerWidth, window.innerHeight);
    main.dataset.viewerState = "ready";
  } catch {
    current = undefined;
    message("The diagram could not be rendered in this browser.", true);
  }
};
const load = (): void => {
  const id = ++generation;
  worker?.terminate();
  worker = undefined;
  current = undefined;
  if (!location.hash || location.hash === "#") {
    message("This link contains no report data.", true);
    return;
  }
  message("Opening report…");
  try {
    worker = startWorker(
      new URL("./load.worker.js", import.meta.url),
      { type: "decode", fragment: location.hash },
      (reply) => {
        if (id !== generation) return;
        if (reply.type === "decoded") {
          document.title = reply.report.title;
          current = reply.report.data;
          draw();
        } else if (reply.type === "error") message(reply.message, true);
        if (reply.type !== "progress") {
          worker?.terminate();
          worker = undefined;
        }
      },
    );
  } catch {
    message("This viewer requires browser worker support. Use a current desktop browser.", true);
  }
};
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", load, { once: true });
else load();
window.addEventListener("hashchange", load);
let frame = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
});
window.addEventListener("pagehide", () => {
  generation++;
  worker?.terminate();
  cancelAnimationFrame(frame);
});
