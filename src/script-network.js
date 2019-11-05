import { select } from "d3-selection";
import { max as d3max, extent as d3extent } from "d3-array";
import { scaleSqrt } from "d3-scale";

import { mouse as d3mouse } from "d3-selection";

import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";

import { format as formatBytes } from "bytes";

import { createTooltip, createMouseleave, createMouseover } from "./tooltip";

const createMousemove = (tooltipNode, container) => d => {
  const [x, y] = d3mouse(container);
  const nodePath = d.id;

  let str = `${nodePath}`;
  const size = d.value || d.size;
  if (size !== 0) {
    str += `<br/><b>${formatBytes(size)}</b>`;
  }

  tooltipNode
    .html(str)
    .style("left", x + 30 + "px")
    .style("top", y + "px");
};

import "./style/style-network.scss";

function color(group) {
  if (group === 0) {
    return "#487ea4";
  } else {
    return "#599e59";
  }
}

const WIDTH = window.chartParameters.width || 1500;
const HEIGHT = window.chartParameters.height || 1000;

const mainContainer = document.querySelector("#main");

for (const data of window.nodesData) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
      <div class="chart">
      </div>
      `;
  const chartNode = wrapper.querySelector(".chart");
  mainContainer.appendChild(chartNode);

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
    .force("collide", forceCollide().radius(d => size(d.size) + 1))
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
    .attr("fill", d => (d.size === 0 ? "#ccc" : color(d.group)))
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .on("mouseover", createMouseover(tooltip, chartNode))
    .on("mousemove", createMousemove(tooltip, chartNode))
    .on("mouseleave", createMouseleave(tooltip, chartNode));
}
