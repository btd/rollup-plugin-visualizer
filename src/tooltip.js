import { mouse as d3mouse } from "d3-selection";
import { format as formatBytes } from "bytes";

const getNodePathTree = d =>
  d
    .ancestors()
    .reverse()
    .map(d => d.data.name)
    .join("/");

const getNodeSizeTree = d => d.value;

const getNodeUidTree = d => d.data.uid;

export class Tooltip {
  constructor(
    container,
    {
      totalSize,
      getNodeSize = getNodeSizeTree,
      getNodePath = getNodePathTree,
      getNodeUid = getNodeUidTree,
      nodes,
      links
    }
  ) {
    this.tooltip = container
      .append("div")
      .style("opacity", 0)
      .attr("class", "tooltip");

    this.totalSize = totalSize;
    this.getNodePath = getNodePath;
    this.getNodeSize = getNodeSize;
    this.getNodeUid = getNodeUid;

    this.tooltipContentCache = new Map();
    this.importedByCache = new Map();
    this.importedCache = new Map();

    if (links != null && nodes != null) {
      this.refillLinksCache({ nodes, links });
    }

    this.container = container;

    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  refillLinksCache({ nodes, links }) {
    for (const { source, target } of links) {
      if (!this.importedByCache.has(target)) {
        this.importedByCache.set(target, new Set());
      }
      if (!this.importedCache.has(source)) {
        this.importedCache.set(source, new Set());
      }

      this.importedByCache.get(target).add(nodes[source]);
      this.importedCache.get(source).add(nodes[target]);
    }
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

    const size = this.getNodeSize(data);
    if (size !== 0) {
      let sizeStr = `<b>Size: ${formatBytes(size)}</b>`;

      if (this.totalSize != null) {
        const percentageNum = (100 * data.value) / this.totalSize;
        const percentage = percentageNum.toFixed(2);
        const percentageString = percentage + "%";

        sizeStr += ` (${percentageString})`;
      }
      str.push(sizeStr);
    }

    const uid = this.getNodeUid(data);
    if (uid && this.importedByCache.has(uid)) {
      const importedBy = this.importedByCache.get(uid);
      str.push(
        `<b>Imported By</b>: <br/>${[...importedBy]
          .map(i => i.id)
          .join("<br/>")}`
      );
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
