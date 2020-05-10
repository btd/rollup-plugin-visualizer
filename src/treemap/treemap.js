import { useState } from "preact/hooks";
import { html } from "htm/preact";
import { group } from "d3-array";

import Node from "./node.js";

const TreeMap = ({
  root,
  layout,
  color,
  width,
  height,
  onNodeHover,
  sizeProperty,
}) => {
  const [selectedNode, setSelectedNode] = useState(null);

  const desiredValue = root.originalValue[sizeProperty] * 0.2;

  //handle zoom of selected node
  const selectedNodeMultiplier =
    selectedNode != null
      ? desiredValue > selectedNode.originalValue[sizeProperty]
        ? desiredValue / selectedNode.originalValue[sizeProperty]
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
  root = root.eachAfter((node) => {
    let sum = 0;
    const children = node.children;
    if (children != null) {
      let i = children.length;
      while (--i >= 0) sum += children[i].value;
    } else {
      sum = nodesToIncreaseSet.has(node)
        ? node.originalValue[sizeProperty] * selectedNodeMultiplier
        : node.originalValue[sizeProperty];
    }

    node.value = sum;
  });

  layout(root);

  // this will make groups by height
  const nestedDataMap = group(root.descendants(), (d) => d.height);
  const nestedData = Array.from(nestedDataMap, ([key, values]) => ({
    key,
    values,
  }));
  nestedData.sort((a, b) => b.key - a.key);

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${width} ${height}`}>
      ${nestedData.map(({ key, values }) => {
        return html`
          <g class="layer" key=${key}>
            ${values.map((node) => {
              const { backgroundColor, fontColor } = color(node);
              return html`
                <${Node}
                  node=${node}
                  backgroundColor=${backgroundColor}
                  fontColor=${fontColor}
                  onClick=${() =>
                    setSelectedNode(selectedNode === node ? null : node)}
                  isSelected=${selectedNode === node}
                  onNodeHover=${onNodeHover}
                  sizeProperty=${sizeProperty}
                />
              `;
            })}
          </g>
        `;
      })}
    </svg>
  `;
};

export default TreeMap;
