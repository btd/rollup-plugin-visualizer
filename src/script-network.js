import { select, event as d3event } from "d3-selection";
import { drag as d3drag } from "d3-drag";

import { mouse as d3mouse } from "d3-selection";

import {
  forceSimulation as d3forceSimulation,
  forceLink as d3forceLink,
  forceManyBody as d3forceManyBody,
  forceCenter as d3forceCenter,
  forceCollide as d3forceCollide
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

const drag = simulation => {
  function dragstarted(d) {
    if (!d3event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3event.x;
    d.fy = d3event.y;
  }

  function dragended(d) {
    if (!d3event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
};

import "./style/style-network.scss";

function color(group) {
  if (group === 0) {
    return "#db7100";
  } else {
    return "#599e59";
  }
}

const radius = d => {
  const r = Math.sqrt(d.size) / 3;
  return r < 5 ? 5 : r;
};

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

  const svg = select(chartNode)
    .append("svg")
    .attr("viewBox", [0, 0, WIDTH, HEIGHT]);

  const simulation = d3forceSimulation(nodes)
    .force("link", d3forceLink(links).id(d => d.id))
    .force("charge", d3forceManyBody())
    .force("center", d3forceCenter(WIDTH / 2, HEIGHT / 2))
    .force("collide", d3forceCollide().radius(radius));

  const link = svg
    .append("g")
    .attr("stroke", "#999")
    .attr("stroke-opacity", 0.6)
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke-width", d => Math.sqrt(d.value));

  const node = svg
    .append("g")
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", radius)
    .attr("fill", d => color(d.group))

    .on("mouseover", createMouseover(tooltip, chartNode))
    .on("mousemove", createMousemove(tooltip, chartNode))
    .on("mouseleave", createMouseleave(tooltip, chartNode))
    .call(drag(simulation));

  //node.append("title").text(d => d.id);

  simulation.on("tick", () => {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node.attr("cx", d => d.x).attr("cy", d => d.y);
  });
}
