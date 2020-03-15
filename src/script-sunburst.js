import { select } from "d3-selection";
import {
  partition as d3partition,
  hierarchy as d3hierarchy
} from "d3-hierarchy";
import { arc as d3arc } from "d3-shape";
import { scaleLinear, scaleSqrt } from "d3-scale";
import { format as formatBytes } from "bytes";

import color from "./color";

import "./style/style-sunburst.scss";

const drawChart = (parentNode, { tree, nodes }, width, height) => {
  const size = Math.min(width, height);

  const radius = size / 2;

  const x = scaleLinear().range([0, 2 * Math.PI]);
  const y = scaleSqrt().range([0, radius]);

  const arc = d3arc()
    .startAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x0))))
    .endAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x1))))
    .innerRadius(d => y(d.y0))
    .outerRadius(d => y(d.y1));

  const chartContainerMarkup = `
<div class="details" style="display: none;">
  <div class="details-name" ></div>
  <div class="details-percentage" ></div>
  of bundle size
  <div class="details-size" ></div>
</div>
`;

  parentNode.innerHTML = chartContainerMarkup;

  const chartNode = select(parentNode);

  const svg = chartNode.append("svg").attr("viewBox", [0, 0, size, size]);
  const g = svg.append("g").attr("transform", `translate(${radius},${radius})`);

  let root = d3hierarchy(tree)
    .eachAfter(node => {
      let sum = 0;
      const children = node.children;
      if (children != null) {
        let i = children.length;
        while (--i >= 0) sum += children[i].value;
      } else if (node.data.uid != null) {
        sum = nodes[node.data.uid].renderedLength;
      }

      node.value = sum;
      node.originalValue = sum;
    })
    .sort((a, b) => b.originalValue - a.originalValue);

  const layout = d3partition();

  const showDetails = ({ data, originalValue }) => {
    const percentageNum = (100 * originalValue) / root.originalValue;
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    chartNode.select(".details-name").text(data.name);

    chartNode.select(".details-percentage").text(percentageString);

    chartNode.select(".details-size").text(formatBytes(originalValue));

    chartNode.select(".details").style("display", "block");
  };

  const desiredValue = root.originalValue * 0.2;

  const updateChart = selectedNode => {
    //handle zoom of selected node
    const selectedNodeMultiplier =
      selectedNode != null
        ? (desiredValue > selectedNode.originalValue
            ? desiredValue / selectedNode.originalValue
            : 3) * selectedNode.height
        : 1;

    // i only need to increase value of leaf nodes
    // as folders will sum they up
    const nodesToIncrease =
      selectedNode != null
        ? selectedNode.children != null
          ? selectedNode.leaves()
          : [selectedNode]
        : [];

    const nodesToIncreaseSet = new Set(nodesToIncrease);

    root = root.eachAfter(node => {
      let sum = 0;
      const children = node.children;
      if (children != null) {
        let i = children.length;
        while (--i >= 0) sum += children[i].value;
      } else {
        sum = nodesToIncreaseSet.has(node)
          ? node.originalValue * selectedNodeMultiplier
          : node.originalValue;
      }

      node.value = sum;
    });

    layout(root);

    const path = g
      .selectAll("path")
      .data(root.descendants(), d => d)
      .join("path")
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
      .style("stroke", "#fff")
      .style("fill", d => color(d))
      .on("mouseover", (event, data) => {
        showDetails(data);

        const sequenceArray = data.ancestors();

        // Fade all the segments.
        path.style("opacity", 0.3);

        // Then highlight only those that are an ancestor of the current segment.
        path.filter(node => sequenceArray.includes(node)).style("opacity", 1);
      })
      .on("click", (event, d) => {
        if (d === selectedNode) {
          updateChart();
        } else {
          updateChart(d);
        }
      });

    if (selectedNode != null) {
      path
        .filter(d => d === selectedNode)
        .style("stroke", "#fff")
        .attr("stroke-width", 3);
    }
  };

  chartNode.on("mouseleave", () => {
    g.selectAll("path").style("opacity", 1);

    showDetails(root);
  });

  updateChart();
  showDetails(root);
};

export default drawChart;
