import { select } from "d3-selection";
import { max as d3max, extent as d3extent } from "d3-array";
import { scaleSqrt } from "d3-scale";

import { mouse as d3mouse } from "d3-selection";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX
} from "d3-force";

import { format as formatBytes } from "bytes";

import { createTooltip, createMouseleave, createMouseover } from "./tooltip";

const createMousemove = (tooltipNode, container) => d => {
  const [x, y] = d3mouse(container);
  const nodePath = d.id;

  const str = `${nodePath}<br/><b>${formatBytes(d.value || d.size)}</b>`;

  tooltipNode
    .html(str)
    .style("left", x + 30 + "px")
    .style("top", y + "px");
};

import "./style/style-network.scss";

function color(group) {
  if (group === 0) {
    return "#db7100";
  } else {
    return "#599e59";
  }
}

const WIDTH = 1000;
const HEIGHT = 1000;

const chartsContainer = document.querySelector("#charts");

for (const { id, root: data } of window.nodesData) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
      <div class="chart">
        <h3>${id}</h3>
      </div>
      `;
  const chartNode = wrapper.querySelector(".chart");
  chartsContainer.appendChild(chartNode);

  const tooltip = createTooltip(select(chartNode));

  const nodes = Object.entries(data.nodes).map(([id, mod]) => ({ id, ...mod }));
  const index = new Map(nodes.map(d => [d.id, d]));
  const links = data.links.map(d =>
    Object.assign(Object.create(d), {
      source: index.get(d.source),
      target: index.get(d.target),
      value: 1
    })
  );

  const maxLines = d3max(nodes, d => d.size);
  const size = scaleSqrt()
    .domain([1, maxLines])
    .range([1, 30]);

  const svg = select(chartNode)
    .append("svg")
    .attr("viewBox", [0, 0, WIDTH, HEIGHT]);

  const simulation = forceSimulation()
    .force(
      "link",
      forceLink()
        .id(d => d.id)
        .strength(2)
    )
    .force("collide", forceCollide().radius(d => size(d.size) + 1))
    .force("forceX", forceX(HEIGHT / 2).strength(0.05))
    .force("charge", forceManyBody().strength(-10))
    .force("center", forceCenter(WIDTH / 2, HEIGHT / 2));

  simulation.nodes(nodes);
  simulation.force("link").links(links);
  simulation.stop();

  for (let i = 0; i < 150; i++) simulation.tick();

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
    .attr("fill", d => color(d.group))
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .on("mouseover", createMouseover(tooltip, chartNode))
    .on("mousemove", createMousemove(tooltip, chartNode))
    .on("mouseleave", createMouseleave(tooltip, chartNode));
}
