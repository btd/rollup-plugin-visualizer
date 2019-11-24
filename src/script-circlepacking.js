import { select } from "d3-selection";
import { group } from "d3-array";
import { hierarchy as d3hierarchy, pack as d3pack } from "d3-hierarchy";

import uid from "./uid";
import { createRainbowColor } from "./color";

import { Tooltip } from "./tooltip";

import "./style/style-circlepacking.scss";

const drawChart = (parentNode, { tree, nodes, links }, width, height) => {
  const size = Math.min(width, height);
  const layout = d3pack()
    .size([size, size])
    .padding(3);

  const chartNode = select(parentNode);

  const svg = chartNode
    .append("svg")
    .attr("viewBox", [0, 0, size, size])
    .attr("text-anchor", "middle");

  const tooltip = new Tooltip(chartNode);

  let root = d3hierarchy(tree)
    .eachAfter(node => {
      let sum = 0;
      const children = node.children;
      if (children != null) {
        let i = children.length;
        while (--i >= 0) sum += children[i].value;
      } else {
        sum = nodes[node.data.uid].renderedLength;
      }

      node.clipUid = uid("clip");
      node.leafUid = uid("leaf");

      node.value = sum;
      node.originalValue = sum;
    })
    .sort((a, b) => b.originalValue - a.originalValue);

  const color = createRainbowColor(root);
  const desiredValue = root.originalValue * 0.2;

  const updateChart = selectedNode => {
    //handle zoom of selected node
    const selectedNodeMultiplier =
      selectedNode != null
        ? desiredValue > selectedNode.originalValue
          ? desiredValue / selectedNode.originalValue
          : 3
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

    // this will make groups by height
    const nestedDataMap = group(root.descendants(), d => d.height);
    const nestedData = Array.from(nestedDataMap, ([key, values]) => ({
      key,
      values
    }));
    nestedData.sort((a, b) => b.key - a.key);

    const layers = svg
      .selectAll(".layer")
      .data(nestedData, d => d.key)
      .join("g")
      .attr("class", "layer");

    const nodeGroups = layers
      .selectAll(".node")
      .data(
        d => d.values,
        d => d
      )
      .join("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.x + 1},${d.y + 1})`)
      .on("mouseover", tooltip.onMouseOver)
      .on("mousemove", tooltip.onMouseMove)
      .on("mouseleave", tooltip.onMouseLeave)
      .on("click", (event, d) => {
        if (d === selectedNode) {
          updateChart();
        } else {
          updateChart(d);
        }
      });

    const circle = nodeGroups
      .selectAll("circle")
      .data(d => [d])
      .join("circle")
      .attr("r", d => d.r)
      .attr("fill", d => color(d).backgroundColor)
      .style("stroke", null)
      .attr("stroke-width", null);

    if (selectedNode != null) {
      circle
        .filter(d => d === selectedNode)
        .style("stroke", "#fff")
        .attr("stroke-width", 2);
    }

    const leaf = nodeGroups.filter(d => !d.children);

    leaf.select("circle").attr("id", d => d.leafUid.id);

    leaf
      .selectAll("clipPath")
      .data(d => [d])
      .join("clipPath")
      .attr("id", d => d.clipUid.id)
      .selectAll("use")
      .data(d => [d])
      .join("use")
      .attr("xlink:href", d => d.leafUid.href);

    leaf
      .append("text")
      .attr("clip-path", d => d.clipUid)
      .style("fill", d => color(d).fontColor)
      .selectAll("tspan")
      .data(d => [d.data.name])
      .join("tspan")
      .attr("x", 0)
      .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`)
      .style("font-size", "0.7em")
      .text(d => d);

    tooltip.buildCache(nodeGroups, {
      getNodeSize: d => d.originalValue,
      totalSize: root.originalValue,
      nodes,
      links
    });
  };

  updateChart();
};

export default drawChart;
