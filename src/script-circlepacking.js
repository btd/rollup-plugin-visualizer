import { select } from "d3-selection";
import { nest as d3nest } from "d3-collection";
import uid from "./uid";
import color from "./color";
import { hierarchy as d3hierarchy, pack as d3pack } from "d3-hierarchy";
import { format as formatBytes } from "bytes";

const WIDTH = 1000;
const HEIGHT = 1000;

const chartsContainer = document.querySelector("#charts");

const format = formatBytes;

for (const { id, root: data } of window.nodesData) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
      <div class="chart">
        <h3>${id}</h3>
      </div>
      `;
  const chartNode = wrapper.querySelector(".chart");
  chartsContainer.appendChild(chartNode);

  const root = d3hierarchy(data)
    .sum(d => {
      if (d.children && d.children.length) {
        return 0;
      } else {
        return d.size;
      }
    })
    .sort();

  const layout = d3pack()
    .size([WIDTH - 2, HEIGHT - 2])
    .padding(3);

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

  const node = svg
    .selectAll("g")
    .data(
      d3nest()
        .key(d => d.height)
        .entries(root.descendants())
    )
    .join("g")
    .attr("filter", shadow)
    .selectAll("g")
    .data(d => d.values)
    .join("g")
    .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`);

  node
    .append("circle")
    .attr("r", d => d.r)
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
    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
    .join("tspan")
    .attr("x", 0)
    .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
    .text(d => d);

  node.append("title").text(
    d =>
      `${d
        .ancestors()
        .map(d => d.data.name)
        .reverse()
        .join("/")}\n${format(d.value)}`
  );
}
