import { mouse as d3mouse } from "d3-selection";
import { format as formatBytes } from "bytes";

// https://www.d3-graph-gallery.com/graph/interactivity_tooltip.html#template

export const createTooltip = node =>
  node
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip");

export const createMouseover = tooltipNode => () => tooltipNode.style("opacity", 1);

const tooltipCache = new Map();

export const createMousemove = (tooltipNode, container, totalSize) => d => {
  if (!tooltipCache.has(d)) {
    const nodePath = d
      .ancestors()
      .reverse()
      .map(d => d.data.name)
      .join("/");

    const percentageNum = (100 * d.value) / totalSize;
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    const str = `${nodePath}<br/><b>${formatBytes(d.value || d.size)}</b><br/>${percentageString}`;

    tooltipCache.set(d, { html: str });
  }

  const { html } = tooltipCache.get(d);

  tooltipNode.html(html);

  const [x, y] = d3mouse(container);

  const tooltipBox = tooltipNode.node().getBoundingClientRect();
  const containerBox = container.getBoundingClientRect();

  const availableWidthRight = containerBox.width - x;
  const availableHeightBottom = containerBox.height - y;

  const positionStyles = [];
  const offsetX = 10;
  const offsetY = 10;
  if (availableHeightBottom >= tooltipBox.height + offsetY) {
    positionStyles.push(["top", y + offsetY], ["bottom", null]);
  } else {
    positionStyles.push(["top", null], ["bottom", availableHeightBottom + offsetY]);
  }
  if (availableWidthRight >= tooltipBox.width + offsetX) {
    positionStyles.push(["left", x + offsetX], ["right", null]);
  } else {
    positionStyles.push(["left", null], ["right", availableWidthRight + offsetX]);
  }

  for (const [pos, offset] of positionStyles) {
    tooltipNode.style(pos, typeof offset === "number" ? offset + "px" : offset);
  }
};

export const createMouseleave = tooltipNode => () => tooltipNode.style("opacity", 0);
