import "./style.scss";

import { createReportUrl } from "../../shared/share/url.js";
import { startWorker } from "./worker.js";

const fileInput = document.querySelector<HTMLInputElement>("#report-file")!;
const templates = document.querySelector<HTMLFieldSetElement>("#template-options")!;
const form = document.querySelector<HTMLFormElement>("#report-form")!;
const drop = document.querySelector<HTMLElement>("#drop-target")!;
const status = document.querySelector<HTMLElement>("#status")!;
const result = document.querySelector<HTMLElement>("#result")!;
const caption = document.querySelector<HTMLElement>("#result-caption")!;
const link = document.querySelector<HTMLAnchorElement>("#open-report")!;
const copy = document.querySelector<HTMLButtonElement>("#copy-link")!;
const copyLabel = document.querySelector<HTMLElement>("#copy-label")!;
const generate = document.querySelector<HTMLButtonElement>("#generate")!;
const cancel = document.querySelector<HTMLButtonElement>("#cancel")!;
const fileName = document.querySelector<HTMLElement>("#file-name")!;
const fileHint = document.querySelector<HTMLElement>("#file-hint")!;
let selected: File | undefined,
  worker: Worker | undefined,
  generation = 0,
  dragDepth = 0,
  reportUrl = "";

const setStatus = (message: string, state: "idle" | "loading" | "ready" | "error"): void => {
  status.textContent = message;
  status.dataset.state = state;
  form.dataset.state = state;
};
const stop = (): void => {
  generation++;
  worker?.terminate();
  worker = undefined;
  form.setAttribute("aria-busy", "false");
  cancel.hidden = true;
  generate.disabled = !selected;
};
const clear = (): void => {
  result.hidden = true;
  link.removeAttribute("href");
  reportUrl = "";
  copyLabel.textContent = "Copy link";
};
const run = (): void => {
  stop();
  clear();
  if (!selected) {
    setStatus("Choose a report to get started.", "idle");
    return;
  }
  const current = generation;
  const template = templates.querySelector<HTMLInputElement>("input:checked")!;
  const diagram = template.value;
  const diagramName = template.closest("label")!.querySelector(".diagram-name")!.textContent;
  const name = selected.name;
  form.setAttribute("aria-busy", "true");
  cancel.hidden = false;
  generate.disabled = true;
  setStatus("Reading report…", "loading");
  try {
    worker = startWorker(
      new URL("./load.worker.js", import.meta.url),
      { type: "encode", file: selected },
      (reply) => {
        if (current !== generation) return;
        if (reply.type === "progress") {
          setStatus(reply.message, "loading");
          return;
        }
        if (reply.type === "encoded") {
          try {
            reportUrl = createReportUrl(new URL("./", location.href).href, diagram, reply.fragment);
            link.href = reportUrl;
            caption.textContent = `${diagramName} · ${name}`;
            result.hidden = false;
            setStatus("Ready to explore. Open your report or copy the link.", "ready");
          } catch {
            setStatus("Could not construct the report link.", "error");
          }
        } else if (reply.type === "error") setStatus(reply.message, "error");
        stop();
      },
    );
  } catch {
    stop();
    setStatus(
      "This viewer requires browser worker support. Use a current desktop browser.",
      "error",
    );
  }
};

const select = (file: File | undefined): void => {
  selected = file;
  drop.classList.toggle("has-file", !!file);
  fileName.textContent = file ? file.name : "Drop your report here";
  const units = file && file.size >= 1024 * 1024 ? "MiB" : "KiB";
  const divisor = units === "MiB" ? 1024 * 1024 : 1024;
  fileHint.textContent = file
    ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(file.size / divisor)} ${units} · Drop another file to replace`
    : "Raw-data JSON · Up to 64 MiB";
  run();
};
fileInput.addEventListener("change", () => select(fileInput.files?.[0]));
templates.addEventListener("change", run);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  run();
});
cancel.addEventListener("click", () => {
  stop();
  clear();
  setStatus("Cancelled. Generate the link again when ready.", "idle");
});
const isFileDrag = (event: DragEvent): boolean => !!event.dataTransfer?.types.includes("Files");
drop.addEventListener("dragenter", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragDepth++;
  drop.classList.add("dragging");
});
drop.addEventListener("dragover", (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = "copy";
  drop.classList.add("dragging");
});
drop.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) drop.classList.remove("dragging");
});
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  drop.classList.remove("dragging");
  stop();
  clear();
  const files = event.dataTransfer?.files;
  fileInput.value = "";
  if (files?.length !== 1) {
    select(undefined);
    setStatus("Choose one raw-data JSON file at a time.", "error");
    return;
  }
  select(files[0]);
});
// Keep an accidental file drop outside the target from navigating away from the viewer.
for (const type of ["dragover", "drop"] as const)
  document.addEventListener(type, (event) => {
    if (isFileDrag(event)) event.preventDefault();
  });
copy.addEventListener("click", async () => {
  const url = reportUrl;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    if (url === reportUrl) {
      copyLabel.textContent = "Copied";
      setStatus("Report link copied.", "ready");
    }
  } catch {
    if (url === reportUrl) {
      copyLabel.textContent = "Copy link";
      link.focus();
      setStatus("Copy is unavailable. Use Open report’s context menu to copy the link.", "ready");
    }
  }
});
window.addEventListener("pagehide", stop);
