import { mouse as d3mouse } from "d3-selection";
import { format as formatBytes } from "bytes";

//https://www.d3-graph-gallery.com/graph/interactivity_tooltip.html#template

export const createTooltip = node =>
  node
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px");

export const createMouseover = (tooltipNode, container) => d => tooltipNode.style("opacity", 1);

export const createMousemove = (tooltipNode, container, totalSize) => d => {
  const [x, y] = d3mouse(container);
  const nodePath = d
    .ancestors()
    .reverse()
    .map(d => d.data.name)
    .join("/");

  const percentageNum = (100 * d.value) / totalSize;
  const percentage = percentageNum.toFixed(2);
  const percentageString = percentage + "%";

  tooltipNode
    .html(`${nodePath}<br/><b>${formatBytes(d.value)}</b><br/>${percentageString}`)
    .style("left", x + 30 + "px")
    .style("top", y + "px");
};

export const createMouseleave = (tooltipNode, container) => d => tooltipNode.style("opacity", 0);
