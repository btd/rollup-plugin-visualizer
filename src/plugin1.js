import { select } from "d3-selection";
import { partition as d3partition, hierarchy as d3hierarchy } from "d3-hierarchy";
import { arc as d3arc } from "d3-shape";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { format as formatBytes } from "bytes";

const WIDTH = 700;
const HEIGHT = 700;
const RADIUS = Math.min(WIDTH, HEIGHT) / 2 - 10;

function getAncestors(node) {
  const path = [];
  let current = node;
  while (current.parent) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

function color(node) {
  if (node.children && node.children.length) {
    const parents = getAncestors(node);
    const hasNodeModules = !!parents.filter(function(n) {
      return n.data.name === "node_modules";
    }).length;
    return hasNodeModules ? "#599e59" : "#487ea4";
  } else {
    return "#db7100";
  }
}

const x = scaleLinear().range([0, 2 * Math.PI]);
const y = scaleSqrt().range([0, RADIUS]);

const chartsContainer = document.querySelector("#charts");

window.nodesData.forEach(({ id, root: data }) => {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <div class="chart">
      <h3>${id}</h3>
      <div class="details" style="display: none;">
        <div class="details-name" ></div>
        <div class="details-percentage" ></div>
        of bundle size
        <div class="details-size" ></div>
      </div>
    </div>
    `;
  const chartNode = wrapper.querySelector(".chart");
  chartsContainer.appendChild(chartNode);

  const g = select(chartNode)
    .append("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .append("g")
    .attr("transform", "translate(" + WIDTH / 2 + "," + HEIGHT / 2 + ")");

  const arc = d3arc()
    .startAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x0))))
    .endAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x1))))
    .innerRadius(d => y(d.y0))
    .outerRadius(d => y(d.y1));

  const root = d3hierarchy(data)
    .sum(function(d) {
      if (d.children && d.children.length) {
        return 0;
      } else {
        return d.size;
      }
    })
    .sort();

  const partition = d3partition();

  partition(root);

  g.selectAll("path")
    .data(partition(root).descendants())
    .enter()
    .append("path")
    .attr("display", function(d) {
      return d.depth ? null : "none";
    })
    .attr("d", arc)
    .attr("fill-rule", "evenodd")
    .style("stroke", "#fff")
    .style("fill", function(d) {
      return color(d);
    })
    .on("mouseover", mouseover);

  const totalSize = root.value;

  select(chartNode).on("mouseleave", mouseleave);

  function mouseover(d) {
    const percentageNum = (100 * d.value) / totalSize;
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    select(chartNode)
      .select(".details-name")
      .text(d.data.name);

    select(chartNode)
      .select(".details-percentage")
      .text(percentageString);

    select(chartNode)
      .select(".details-size")
      .text(formatBytes(d.value));

    select(chartNode)
      .select(".details")
      .style("display", "block");

    const sequenceArray = getAncestors(d);
    //updateBreadcrumbs(sequenceArray, percentageString);

    // Fade all the segments.
    g.selectAll("path").style("opacity", 0.3);

    // Then highlight only those that are an ancestor of the current segment.
    g.selectAll("path")
      .filter(function(node) {
        return sequenceArray.indexOf(node) >= 0;
      })
      .style("opacity", 1);
  }

  function mouseleave() {
    g.selectAll("path").style("opacity", 1);

    select(".details").style("display", "none");
  }
});
