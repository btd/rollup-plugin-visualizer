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
  constructor(container) {
    this.tooltip = container
      .append("div")
      .style("opacity", 0)
      .attr("class", "tooltip");

    this.container = container;

    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  onMouseOver() {
    this.tooltip.style("opacity", 1);
  }

  onMouseMove(data) {
    const { html } = this.tooltipContentCache.get(data);

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

  buildCache(
    contentNodes,
    {
      totalSize,
      getNodeSize = getNodeSizeTree,
      getNodePath = getNodePathTree,
      getNodeUid = getNodeUidTree,
      nodes,
      links
    }
  ) {
    this.tooltipContentCache = new Map();

    const importedByCache = new Map();
    const importedCache = new Map();

    for (const { source, target } of links) {
      if (!importedByCache.has(target)) {
        importedByCache.set(target, []);
      }
      if (!importedCache.has(source)) {
        importedCache.set(source, []);
      }

      importedByCache.get(target).push({ uid: source, ...nodes[source] });
      importedCache.get(source).push({ uid: target, ...nodes[target] });
    }

    contentNodes.each(data => {
      const contentCache = {};

      const str = [];
      if (getNodePath != null) {
        str.push(getNodePath(data));
      }

      const size = getNodeSize(data);
      if (size !== 0) {
        let sizeStr = `<b>Size: ${formatBytes(size)}</b>`;

        if (totalSize != null) {
          const percentageNum = (100 * data.value) / totalSize;
          const percentage = percentageNum.toFixed(2);
          const percentageString = percentage + "%";

          sizeStr += ` (${percentageString})`;
        }
        str.push(sizeStr);
      }

      const uid = getNodeUid(data);
      if (uid && importedByCache.has(uid)) {
        const importedBy = importedByCache.get(uid);
        str.push(
          `<b>Imported By</b>: <br/>${[
            ...new Set(importedBy.map(({ id }) => id))
          ].join("<br/>")}`
        );
      }

      contentCache.html = str.join("<br/>");

      this.tooltipContentCache.set(data, contentCache);
    });
  }
}
