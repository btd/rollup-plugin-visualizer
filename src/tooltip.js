import { mouse as d3mouse } from "d3-selection";
import { format as formatBytes } from "bytes";

export class Tooltip {
  constructor(container, { totalSize, getNodePath }) {
    this.tooltip = container
      .append("div")
      .style("opacity", 0)
      .attr("class", "tooltip");

    this.totalSize = totalSize;
    this.getNodePath = getNodePath;

    this.tooltipContentCache = new Map();
    this.container = container;

    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  onMouseOver() {
    this.tooltip.style("opacity", 1);
  }

  getTooltipContent(data) {
    if (this.tooltipContentCache.has(data)) {
      return this.tooltipContentCache.get(data);
    }

    const str = [];
    if (this.getNodePath != null) {
      str.push(this.getNodePath(data));
    }

    const size = data.value || data.size;
    if (size !== 0) {
      str.push(`<b>${formatBytes(size)}</b>`);
    }

    if (this.totalSize != null) {
      const percentageNum = (100 * data.value) / this.totalSize;
      const percentage = percentageNum.toFixed(2);
      const percentageString = percentage + "%";

      str.push(percentageString);
    }

    this.tooltipContentCache.set(data, { html: str.join("<br/>") });

    return this.tooltipContentCache.get(data);
  }

  onMouseMove(data) {
    const { html } = this.getTooltipContent(data);

    this.tooltip.html(html);

    const [x, y] = d3mouse(this.container.node());

    const tooltipBox = this.tooltip.node().getBoundingClientRect();
    const containerBox = this.container.node().getBoundingClientRect();

    const availableWidthRight = containerBox.width - x;
    const availableHeightBottom = containerBox.height - y;

    const positionStyles = [];
    const offsetX = 10;
    const offsetY = 10;
    if (availableHeightBottom >= tooltipBox.height + offsetY) {
      positionStyles.push(["top", y + offsetY], ["bottom", null]);
    } else {
      positionStyles.push(
        ["top", null],
        ["bottom", availableHeightBottom + offsetY]
      );
    }
    if (availableWidthRight >= tooltipBox.width + offsetX) {
      positionStyles.push(["left", x + offsetX], ["right", null]);
    } else {
      positionStyles.push(
        ["left", null],
        ["right", availableWidthRight + offsetX]
      );
    }

    for (const [pos, offset] of positionStyles) {
      this.tooltip.style(
        pos,
        typeof offset === "number" ? offset + "px" : offset
      );
    }
  }

  onMouseLeave() {
    this.tooltip.style("opacity", 0);
  }
}
