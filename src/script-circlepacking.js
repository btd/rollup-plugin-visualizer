import { select } from "d3-selection";
import { nest as d3nest } from "d3-collection";
import { descending } from "d3-array";
import { hierarchy as d3hierarchy, pack as d3pack } from "d3-hierarchy";

import uid from "./uid";
import color from "./color";

import { createTooltip, createMouseleave, createMouseover, createMousemove } from "./tooltip";

import "./style/style-circlepacking.scss";

const WIDTH = window.chartParameters.width || 1000;
const HEIGHT = window.chartParameters.height || 1000;

const addChart = (data, chartNode) => {
  const root = d3hierarchy(data)
    .sum(d => {
      if (d.children && d.children.length) {
        return 0;
      } else {
        return d.size;
      }
    })
    .sort();

  const totalSize = root.value;

  const layout = d3pack()
    .size([WIDTH - 2, HEIGHT - 2])
    .padding(3);

  const tooltip = createTooltip(select(chartNode));

  layout(root);

  const svg = select(chartNode)
    .append("svg")
    .attr("viewBox", [0, 0, WIDTH, HEIGHT])
    .attr("text-anchor", "middle");

  const shadow = uid("shadow");

  svg
    .append("filter")
    .attr("id", shadow.id)
    .append("feDropShadow")
    .attr("flood-opacity", 0.3)
    .attr("dx", 0)
    .attr("dy", 1);

  const nestedData = d3nest()
    .key(d => d.height)
    .sortKeys(descending)
    .entries(root.descendants());

  const node = svg
    .selectAll("g")
    .data(nestedData)
    .join("g")
    .attr("filter", shadow)
    .selectAll("g")
    .data(d => d.values)
    .join("g")
    .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`)
    .on("mouseover", createMouseover(tooltip, chartNode))
    .on("mousemove", createMousemove(tooltip, chartNode, totalSize))
    .on("mouseleave", createMouseleave(tooltip, chartNode));

  node
    .append("circle")
    .attr("r", d => d.r)
    .style("stroke", "#fff")
    .attr("fill", d => color(d));

  const leaf = node.filter(d => !d.children);

  leaf.select("circle").attr("id", d => (d.leafUid = uid("leaf")).id);

  leaf
    .append("clipPath")
    .attr("id", d => (d.clipUid = uid("clip")).id)
    .append("use")
    .attr("xlink:href", d => d.leafUid.href);

  leaf
    .append("text")
    .attr("clip-path", d => d.clipUid)
    .selectAll("tspan")
    .data(d => [d.data.name])
    .join("tspan")
    .attr("x", 0)
    .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
    .style("fill", "#fff")
    .style("font-size", "0.7em")
    .text(d => d);
};

const mainContainer = document.querySelector("main");

if (window.nodesData.length === 1) {
  mainContainer.className = "chart";

  addChart(window.nodesData[0], mainContainer);
} else {
  for (const data of window.nodesData) {
    const chartNode = document.createElement("div");
    chartNode.className = "chart";
    mainContainer.appendChild(chartNode);

    addChart(data, chartNode);
  }
}
