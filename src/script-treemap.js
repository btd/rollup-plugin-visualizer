import { select } from "d3-selection";
import { nest as d3nest } from "d3-collection";
import { descending } from "d3-array";
import {
  hierarchy as d3hierarchy,
  treemap as d3treemap,
  treemapResquarify
} from "d3-hierarchy";
import { transition as d3transition } from "d3-transition";

import { selection } from "d3-selection";
import selection_interrupt from "d3-transition/src/selection/interrupt";
import selection_transition from "d3-transition/src/selection/transition";

selection.prototype.interrupt = selection_interrupt;
selection.prototype.transition = selection_transition;

import { format } from "bytes";

import uid from "./uid";
import { createRainbowColor } from "./color";
import { Tooltip } from "./tooltip";

import "./style/style-treemap.scss";

const WIDTH = window.chartParameters.width || 1600;
const HEIGHT = window.chartParameters.height || 900;

const chartNode = document.querySelector("main");

const { tree, nodes, links } = window.nodesData;

const layout = d3treemap()
  .size([WIDTH, HEIGHT])
  .paddingOuter(8)
  .paddingTop(20)
  .paddingInner(5)
  .round(true)
  .tile(treemapResquarify);

const svg = select(chartNode)
  .append("svg")
  .attr("viewBox", [0, 0, WIDTH, HEIGHT]);

const tooltip = new Tooltip(select(chartNode));

let root = d3hierarchy(tree)
  .eachAfter(node => {
    let sum = 0;
    const children = node.children;
    if (children != null) {
      let i = children.length;
      while (--i >= 0) sum += children[i].value;
    } else {
      const { size } = nodes[node.data.uid];
      sum = size;
    }

    node.value = sum;
    node.originalValue = sum;
  })
  .sort((a, b) => b.originalValue - a.originalValue);

const color = createRainbowColor(root);

const t = d3transition().duration(2000);

const updateChart = selectedNode => {
  const selectedNodeMultiplier = 10;

  const nodesToIncrease =
    selectedNode != null
      ? selectedNode.children != null
        ? selectedNode.leaves()
        : [selectedNode]
      : [];

  const nodesToIncreaseSet = new Set(nodesToIncrease);

  //TODO i do not need to traverse all nodes - limit to selection
  root = root.eachAfter(node => {
    let sum = 0;
    const children = node.children;
    if (children != null) {
      let i = children.length;
      while (--i >= 0) sum += children[i].value;
    } else {
      sum = nodesToIncreaseSet.has(node)
        ? node.originalValue * selectedNodeMultiplier
        : node.originalValue;
    }

    node.value = sum;
  });

  layout(root);

  const nestedData = d3nest()
    .key(d => d.height)
    .sortKeys(descending)
    .entries(root.descendants());

  const layers = svg
    .selectAll(".layer")
    .data(nestedData, d => d.key)
    .join("g")
    .attr("class", "layer");

  const nodeGroups = layers
    .selectAll(".node")
    .data(
      d => d.values,
      d => d
    )
    .join("g")
    .attr("class", "node")
    .on("mouseover", tooltip.onMouseOver)
    .on("mousemove", tooltip.onMouseMove)
    .on("mouseleave", tooltip.onMouseLeave)
    .on("click", d => {
      if (d === selectedNode) {
        updateChart();
      } else {
        updateChart(d);
      }
    });

  nodeGroups.transition(t).attr("transform", d => `translate(${d.x0},${d.y0})`);

  const rect = nodeGroups
    .selectAll("rect")
    .data(d => [d])
    .join("rect")
    .attr("id", d => (d.nodeUid = uid("node")).id)
    .attr("fill", d => color(d).backgroundColor)
    .attr("rx", 2)
    .attr("ry", 2);

  rect
    .transition(t)
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => d.y1 - d.y0);

  nodeGroups
    .selectAll("clipPath")
    .data(d => [d])
    .join("clipPath")
    .attr("id", d => (d.clipUid = uid("clip")).id)
    .selectAll("use")
    .data(d => [d])
    .join("use")
    .attr("xlink:href", d => d.nodeUid.href);

  nodeGroups
    .selectAll("text")
    .data(d => [d])
    .join("text")
    .attr("clip-path", d => d.clipUid)
    .style("fill", d => color(d).fontColor)
    .selectAll("tspan")
    .data(d => [d.data.name, format(d.originalValue)])
    .join("tspan")
    .attr("fill-opacity", (d, i, nodes) =>
      i === nodes.length - 1 ? 0.7 : null
    )
    .style("font-size", "0.7em")
    .text(d => d);

  nodeGroups
    .filter(d => d.children)
    .selectAll("tspan")
    .attr("dx", 3)
    .attr("y", 13);

  nodeGroups
    .filter(d => !d.children)
    .selectAll("tspan")
    .attr("x", 3)
    .attr(
      "y",
      (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`
    );

  tooltip.buildCache(nodeGroups, {
    getNodeSize: d => d.originalValue,
    totalSize: root.originalValue,
    nodes: nodeGroups,
    links
  });
};

updateChart();
