import { html, render, useState } from "htm/preact/standalone";
import { group } from "d3-array";
import {
  hierarchy as d3hierarchy,
  treemap as d3treemap,
  treemapResquarify
} from "d3-hierarchy";

import { format } from "bytes";

import uid from "./uid";
import { createRainbowColor } from "./color";
import { Tooltip } from "./tooltip";

import "./style/style-treemap.scss";

const TreeMap = ({ root, layout, color, width, height }) => {
  const [selectedNode, setSelectedNode] = useState(null);

  const desiredValue = root.originalValue * 0.2;

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

  // update value for nodes
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

  console.log(nestedData);
  console.log(selectedNode);

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${width} ${height}`}>
      ${nestedData.map(({ key, values }) => {
        return html`
          <g class="layer" key=${key}>
            ${values.map(node => {
              //ADD click and tooltip there
              const {
                nodeUid,
                x0,
                x1,
                y1,
                y0,
                clipUid,
                data,
                originalValue,
                children = null
              } = node;

              const { backgroundColor, fontColor } = color(node);

              const tspan1Props = {};
              const tspan2Props = {};
              if (children != null) {
                tspan1Props.dx = 3;
                tspan2Props.dx = 3;
                tspan1Props.y = 13;
                tspan2Props.y = 13;
              } else {
                tspan1Props.x = 3;
                tspan2Props.x = 3;
                tspan1Props.y = "1.1em";
                tspan2Props.y = "2.3em";
              }

              return html`
                <g
                  class="node"
                  transform="translate(${x0},${y0})"
                  onClick=${() =>
                    setSelectedNode(selectedNode === node ? null : node)}
                >
                  <rect
                    id=${nodeUid.id}
                    fill=${backgroundColor}
                    rx=${2}
                    ry=${2}
                    width=${x1 - x0}
                    height=${y1 - y0}
                    stroke=${selectedNode === node ? "#fff": null }
                    stroke-width=${selectedNode === node ? 2 : null}
                  >
                  </rect>
                  <clipPath id=${clipUid.id}>
                    <use xlink:href=${nodeUid.href} />
                  </clipPath>
                  <text clip-path=${clipUid} fill=${fontColor}>
                    <tspan ...${tspan1Props} font-size="0.7em"
                      >${data.name}</tspan
                    >
                    <tspan
                      ...${tspan2Props}
                      fill-opacity=${0.7}
                      font-size="0.7em"
                      >${format(originalValue)}</tspan
                    >
                  </text>
                </g>
              `;
            })}
          </g>
        `;
      })}
    </svg>
  `;
};

const drawChart = (parentNode, { tree, nodes, links }, width, height) => {
  const layout = d3treemap()
    .size([width, height])
    .paddingOuter(8)
    .paddingTop(20)
    .paddingInner(5)
    .round(true)
    .tile(treemapResquarify);

  const root = d3hierarchy(tree)
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
      node.nodeUid = uid("node");

      node.originalValue = sum;
      node.value = sum;
    })
    .sort((a, b) => b.originalValue - a.originalValue);

  const color = createRainbowColor(root);

  const scaleMultiplier = root.originalValue * 0.2;

  render(
    html`
      <${TreeMap}
        layout=${layout}
        root=${root}
        color=${color}
        scaleMultiplier=${scaleMultiplier}
        width=${width}
        height=${height}
      />
    `,
    parentNode
  );
};
/*
const drawChart = (parentNode, { tree, nodes, links }, width, height) => {
  const layout = d3treemap()
    .size([width, height])
    .paddingOuter(8)
    .paddingTop(20)
    .paddingInner(5)
    .round(true)
    .tile(treemapResquarify);

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
      node.nodeUid = uid("node");

      node.originalValue = sum;
      node.value = sum;
    })
    .sort((a, b) => b.originalValue - a.originalValue);

  const color = createRainbowColor(root);

  const desiredValue = root.originalValue * 0.2;

  const charNode = select(parentNode);

  const svg = charNode.append("svg").attr("viewBox", [0, 0, width, height]);

  const tooltip = new Tooltip(charNode);

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

    // update value for nodes
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
      .attr("transform", d => `translate(${d.x0},${d.y0})`)
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
    //fill node groups
    const rect = nodeGroups
      .selectAll("rect")
      .data(d => [d])
      .join("rect")
      .attr("id", d => d.nodeUid.id)
      .attr("fill", d => color(d).backgroundColor)
      .attr("rx", 2)
      .attr("ry", 2)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .style("stroke", null)
      .attr("stroke-width", null);

    if (selectedNode != null) {
      rect
        .filter(d => d === selectedNode)
        .style("stroke", "#fff")
        .attr("stroke-width", 2);
    }

    // add clipPath so text do not go out of node
    nodeGroups
      .selectAll("clipPath")
      .data(d => [d])
      .join("clipPath")
      .attr("id", d => d.clipUid.id)
      .selectAll("use")
      .data(d => [d])
      .join("use")
      .attr("xlink:href", d => d.nodeUid.href);

    // add text with clipping
    const text = nodeGroups
      .selectAll("text")
      .data(d => [d])
      .join("text")
      .attr("clip-path", d => d.clipUid)
      .style("fill", d => color(d).fontColor);

    text
      .selectAll("tspan")
      .data(d => [d.data.name, format(d.originalValue)])
      .join("tspan")
      .attr("fill-opacity", (d, i, nodes) =>
        i === nodes.length - 1 ? 0.7 : null
      )
      .style("font-size", "0.7em")
      .text(d => d);

    nodeGroups
      .filter(d => d.children)
      .selectAll("tspan")
      .attr("dx", 3)
      .attr("y", 13);

    nodeGroups
      .filter(d => !d.children)
      .selectAll("tspan")
      .attr("x", 3)
      .attr(
        "y",
        (d, i, nodes) => `${(i === nodes.length - 1) * 0.3 + 1.1 + i * 0.9}em`
      );

    tooltip.buildCache(nodeGroups, {
      getNodeSize: d => d.originalValue,
      totalSize: root.originalValue,
      nodes,
      links
    });
  };

  updateChart();
};
*/
export default drawChart;
