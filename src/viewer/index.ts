import { createReportUrl } from "../../shared/share/url.js";
import { startWorker } from "./worker.js";

const fileInput = document.querySelector<HTMLInputElement>("#report-file")!;
const template = document.querySelector<HTMLSelectElement>("#template")!;
const form = document.querySelector<HTMLFormElement>("#report-form")!;
const drop = document.querySelector<HTMLElement>("#drop-target")!;
const status = document.querySelector<HTMLElement>("#status")!;
const result = document.querySelector<HTMLElement>("#result")!;
const link = document.querySelector<HTMLAnchorElement>("#open-report")!;
const urlText = document.querySelector<HTMLTextAreaElement>("#report-url")!;
const copy = document.querySelector<HTMLButtonElement>("#copy-link")!;
const generate = document.querySelector<HTMLButtonElement>("#generate")!;
const cancel = document.querySelector<HTMLButtonElement>("#cancel")!;
const fileName = document.querySelector<HTMLElement>("#file-name")!;
let selected: File | undefined,
  worker: Worker | undefined,
  generation = 0;

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
  urlText.value = "";
};
const run = (): void => {
  stop();
  clear();
  if (!selected) {
    status.textContent = "Choose a raw-data JSON file to generate a report link.";
    return;
  }
  const current = generation,
    diagram = template.value;
  form.setAttribute("aria-busy", "true");
  cancel.hidden = false;
  generate.disabled = true;
  status.textContent = "Reading report…";
  try {
    worker = startWorker(
      new URL("./load.worker.js", import.meta.url),
      { type: "encode", file: selected },
      (reply) => {
        if (current !== generation) return;
        if (reply.type === "progress") {
          status.textContent = reply.message;
          return;
        }
        if (reply.type === "encoded") {
          try {
            const url = createReportUrl(new URL("./", location.href).href, diagram, reply.fragment);
            link.href = url;
            urlText.value = url;
            urlText.scrollLeft = 0;
            urlText.scrollTop = 0;
            result.hidden = false;
            status.textContent = "Report link ready. Open it or copy the link.";
          } catch {
            status.textContent = "Could not construct the report link.";
          }
        } else if (reply.type === "error") status.textContent = reply.message;
        stop();
      },
    );
  } catch {
    stop();
    status.textContent =
      "This viewer requires browser worker support. Use a current desktop browser.";
  }
};

const select = (file: File | undefined): void => {
  selected = file;
  fileName.textContent = file ? file.name : "No file selected.";
  run();
};
fileInput.addEventListener("change", () => select(fileInput.files?.[0]));
template.addEventListener("change", run);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  run();
});
cancel.addEventListener("click", () => {
  stop();
  clear();
  status.textContent = "Cancelled. Generate the link again when ready.";
});
drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("dragging");
});
drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("dragging");
  stop();
  clear();
  const files = event.dataTransfer?.files;
  if (files?.length !== 1) {
    selected = undefined;
    fileInput.value = "";
    fileName.textContent = "No file selected.";
    generate.disabled = true;
    status.textContent = "Choose one raw-data JSON file at a time.";
    return;
  }
  fileInput.value = "";
  select(files[0]);
});
copy.addEventListener("click", async () => {
  const url = urlText.value;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    if (url === urlText.value) status.textContent = "Report link copied.";
  } catch {
    if (url === urlText.value) {
      urlText.focus();
      urlText.select();
      status.textContent = "Link selected. Use your browser’s copy command.";
    }
  }
});
window.addEventListener("pagehide", stop);
