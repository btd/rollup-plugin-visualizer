import { select } from "d3-selection";
import { max as d3max, extent as d3extent } from "d3-array";
import { scaleSqrt } from "d3-scale";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX
} from "d3-force";

import { Tooltip } from "./tooltip";

import "./style/style-network.scss";

const NODE_MODULES = /.*(?:\/|\\\\)?node_modules(?:\/|\\\\)([^/\\]+)(?:\/|\\\\).+/;

function color({ id }) {
  const match = id.match(NODE_MODULES);
  if (match) {
    return "#599e59";
  } else {
    return "#487ea4";
  }
}

const WIDTH = window.chartParameters.width || 1500;
const HEIGHT = window.chartParameters.height || 1000;

const chartNode = document.querySelector("main");
const { nodes: origNodes, links: origLinks } = window.nodesData;

const tooltip = new Tooltip(select(chartNode), {
  getNodeUid: d => d.uid,
  getNodePath: d => d.id,
  getNodeSize: d => d.size,
  nodes: origNodes,
  links: origLinks
});

const nodes = Object.entries(origNodes).map(([uid, node]) => ({
  uid,
  ...node
}));
const nodesCache = new Map(nodes.map(d => [d.uid, d]));
const links = origLinks.map(({ source, target }) => ({
  source: nodesCache.get(source),
  target: nodesCache.get(target),
  value: 1
}));

const maxLines = d3max(nodes, d => d.size);
const size = scaleSqrt()
  .domain([1, maxLines])
  .range([5, 30]);

const svg = select(chartNode)
  .append("svg")
  .attr("viewBox", [0, 0, WIDTH, HEIGHT]);

const simulation = forceSimulation()
  .force(
    "link",
    forceLink()
      .id(d => d.id)
      .strength(1)
      .distance(50)
      .iterations(10)
  )
  .force(
    "collide",
    forceCollide().radius(d => size(d.size) + 1)
  )
  .force("forceX", forceX(HEIGHT / 2).strength(0.05))
  .force("charge", forceManyBody().strength(-100))
  .force("center", forceCenter(WIDTH / 2, HEIGHT / 2));

simulation.nodes(nodes);
simulation.force("link").links(links);
simulation.stop();

for (let i = 0; i < 300; i++) simulation.tick();

const xExtent = d3extent(nodes, d => d.x);
const yExtent = d3extent(nodes, d => d.y);

const xRange = xExtent[1] - xExtent[0];
const yRange = yExtent[1] - yExtent[0];

if (yRange > xRange) {
  nodes.forEach(d => {
    const y = parseFloat(d.y);
    d.y = parseFloat(d.x);
    d.x = y;
  });
}

//TODO by idea i can move it to the center if it is required

svg
  .append("g")
  .attr("stroke", "#999")
  .attr("stroke-opacity", 0.6)
  .selectAll("line")
  .data(links)
  .join("line")
  .attr("stroke-width", 1)
  // set correct positions
  .attr("x1", d => d.source.x)
  .attr("y1", d => d.source.y)
  .attr("x2", d => d.target.x)
  .attr("y2", d => d.target.y);

svg
  .append("g")
  .attr("stroke", "#fff")
  .attr("stroke-width", 1.5)
  .selectAll("circle")
  .data(nodes)
  .join("circle")
  .attr("r", d => size(d.size))
  .attr("fill", d => (d.size === 0 ? "#ccc" : color(d)))
  .attr("cx", d => d.x)
  .attr("cy", d => d.y)
  .on("mouseover", tooltip.onMouseOver)
  .on("mousemove", tooltip.onMouseMove)
  .on("mouseleave", tooltip.onMouseLeave);

tooltip.buildCache(svg.selectAll("circle"));
