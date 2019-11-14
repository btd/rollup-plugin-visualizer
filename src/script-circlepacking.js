import { select } from "d3-selection";
import { nest as d3nest } from "d3-collection";
import { descending } from "d3-array";
import { hierarchy as d3hierarchy, pack as d3pack } from "d3-hierarchy";

import uid from "./uid";
import { createRainbowColor } from "./color";

import { Tooltip } from "./tooltip";

import "./style/style-circlepacking.scss";

const WIDTH = window.chartParameters.width || 1000;
const HEIGHT = window.chartParameters.height || 1000;

const chartNode = document.querySelector("main");

const { tree, nodes, links } = window.nodesData;

// prepare data
const root = d3hierarchy(tree)
  .sum(d => (d.children && d.children.length > 0 ? 0 : nodes[d.uid].size))
  .sort((a, b) => b.value - a.value);

const layout = d3pack()
  .size([WIDTH - 2, HEIGHT - 2])
  .padding(3);

layout(root);

const nestedData = d3nest()
  .key(d => d.height)
  .sortKeys(descending)
  .entries(root.descendants());

const color = createRainbowColor(root);
const tooltip = new Tooltip(select(chartNode));

const svg = select(chartNode)
  .append("svg")
  .attr("viewBox", [0, 0, WIDTH, HEIGHT])
  .attr("text-anchor", "middle");



const node = svg
  .selectAll("g")
  .data(nestedData)
  .join("g")
  .selectAll("g")
  .data(d => d.values)
  .join("g")
  .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`)
  .on("mouseover", tooltip.onMouseOver)
  .on("mousemove", tooltip.onMouseMove)
  .on("mouseleave", tooltip.onMouseLeave);

node
  .append("circle")
  .attr("r", d => d.r)
  .attr("fill", d => color(d).backgroundColor);

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
  .style("fill", d => color(d).fontColor)
  .selectAll("tspan")
  .data(d => [d.data.name])
  .join("tspan")
  .attr("x", 0)
  .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
  .style("font-size", "0.7em")
  .text(d => d);

tooltip.buildCache(node.selectAll("circle"), {
  totalSize: root.value,
  nodes,
  links
});
