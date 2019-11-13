import { select } from "d3-selection";
import { nest as d3nest } from "d3-collection";
import { descending } from "d3-array";
import { hierarchy as d3hierarchy, treemap as d3treemap } from "d3-hierarchy";
import { format } from "bytes";

import uid from "./uid";
import { createRainbowColor } from "./color";
import { Tooltip } from "./tooltip";

import "./style/style-treemap.scss";

const WIDTH = window.chartParameters.width || 1600;
const HEIGHT = window.chartParameters.height || 900;

const chartNode = document.querySelector("main");

const { tree: data, nodes, links } = window.nodesData;

const root = d3hierarchy(data)
  .sum(d => {
    if (d.children && d.children.length) {
      return 0;
    } else {
      return nodes[d.uid].size;
    }
  })
  .sort();

const treemapLayout = d3treemap()
  .size([WIDTH, HEIGHT])
  .paddingOuter(8)
  .paddingTop(20)
  .paddingInner(5)
  .round(true);

treemapLayout(root);

const nestedData = d3nest()
  .key(d => d.height)
  .sortKeys(descending)
  .entries(root.descendants());

const svg = select(chartNode)
  .append("svg")
  .attr("viewBox", [0, 0, WIDTH, HEIGHT]);

const color = createRainbowColor(root);
const tooltip = new Tooltip(select(chartNode), {
  totalSize: root.value,
  getNodePath: d => nodes[d.data.uid].id
});

const node = svg
  .selectAll("g")
  .data(nestedData)
  .join("g")
  .selectAll("g")
  .data(d => d.values)
  .join("g")
  .attr("transform", d => `translate(${d.x0},${d.y0})`)
  .on("mouseover", tooltip.onMouseOver)
  .on("mousemove", tooltip.onMouseMove)
  .on("mouseleave", tooltip.onMouseLeave);

node
  .append("rect")
  .attr("id", d => (d.nodeUid = uid("node")).id)
  .attr("fill", d => color(d).backgroundColor)
  .attr("width", d => d.x1 - d.x0)
  .attr("height", d => d.y1 - d.y0)
  .attr("rx", 2)
  .attr("ry", 2);

node
  .append("clipPath")
  .attr("id", d => (d.clipUid = uid("clip")).id)
  .append("use")
  .attr("xlink:href", d => d.nodeUid.href);

node
  .append("text")
  .attr("clip-path", d => d.clipUid)
  .style("fill", d => color(d).fontColor)
  .selectAll("tspan")
  .data(d => [d.data.name, format(d.value)])
  .join("tspan")
  .attr("fill-opacity", (d, i, nodes) => (i === nodes.length - 1 ? 0.7 : null))
  .style("font-size", "0.7em")
  .text(d => d);

node
  .filter(d => d.children)
  .selectAll("tspan")
  .attr("dx", 3)
  .attr("y", 13);

node
  .filter(d => !d.children)
  .selectAll("tspan")
  .attr("x", 3)
  .attr(
    "y",
    (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`
  );
