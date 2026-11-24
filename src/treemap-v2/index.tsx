import { render } from "preact";
import type { VisualizerData } from "../../shared/types";
import { renderEmptyReport } from "../empty-report";
import { Main } from "./main";
import "../style/style-treemap-v2.scss";

const reports = new WeakMap<Element, { data: VisualizerData; key: number }>();
let nextReport = 0;

export default function drawChart(
  parent: Element,
  data: VisualizerData,
  _width: number,
  _height: number,
): void {
  if (!data.tree.children.length) {
    renderEmptyReport(parent);
    return;
  }
  let report = reports.get(parent);
  if (report?.data !== data) {
    report = { data, key: nextReport++ };
    reports.set(parent, report);
  }
  // The host calls drawChart on resize; keeping the component key retains the selection and list state.
  render(<Main key={report.key} data={data} />, parent);
}
