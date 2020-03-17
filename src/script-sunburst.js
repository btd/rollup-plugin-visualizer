import { render } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";
import { html } from "htm/preact";

import { format as formatBytes } from "bytes";

import {
  partition as d3partition,
  hierarchy as d3hierarchy
} from "d3-hierarchy";
import { arc as d3arc } from "d3-shape";
import { scaleLinear, scaleSqrt } from "d3-scale";

import color from "./color";

import "./style/style-sunburst.scss";

const Tooltip = ({ node, root }) => {
  const content = useMemo(() => {
    if (!node) return null;

    const { data, originalValue } = node;

    const percentageNum = (100 * originalValue) / root.originalValue;
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    return html`
      <div class="details-name">${data.name}</div>
      <div class="details-percentage">${percentageString}</div>
      of bundle size
      <div class="details-size">${formatBytes(originalValue)}</div>
    `;
  }, [node]);

  if (!node) return null;

  return html`
    <div class="details">
      ${content}
    </div>
  `;
};

const Node = ({
  node,
  onClick,
  isSelected,
  onNodeHover,
  path,
  highlighted
}) => {
  return html`
    <path
      d=${path}
      fill-rule="evenodd"
      stroke="#fff"
      fill=${color(node)}
      stroke-width=${isSelected ? 3 : null}
      onClick=${onClick}
      onMouseOver=${evt => {
        evt.stopPropagation();
        onNodeHover(node);
      }}
      opacity=${highlighted ? 1 : 0.3}
    />
  `;
};

const SunBurst = ({
  root,
  layout,
  size,
  onNodeHover,
  arc,
  radius,
  highlightedNodes
}) => {
  const [selectedNode, setSelectedNode] = useState(null);

  const desiredValue = root.originalValue * 0.2;

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

  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${size} ${size}`}>
      <g transform=${`translate(${radius},${radius})`}>
        ${root.descendants().map(node => {
          return html`
            <${Node}
              node=${node}
              onClick=${() =>
                setSelectedNode(selectedNode === node ? null : node)}
              isSelected=${selectedNode === node}
              onNodeHover=${onNodeHover}
              path=${arc(node)}
              highlighted=${highlightedNodes.includes(node)}
            />
          `;
        })}
      </g>
    </svg>
  `;
};

const Chart = ({ layout, root, size }) => {
  const [tooltipNode, setTooltipNode] = useState(root);
  const [highlightedNodes, setHighlightedNodes] = useState(root.descendants());

  const handleMouseOut = () => {
    setTooltipNode(root);
    setHighlightedNodes(root.descendants());
  };

  useEffect(() => {
    document.addEventListener("mouseover", handleMouseOut);
    return () => {
      document.removeEventListener("mouseover", handleMouseOut);
    };
  }, []);

  const radius = size / 2;

  const x = scaleLinear().range([0, 2 * Math.PI]);
  const y = scaleSqrt().range([0, radius]);

  const arc = d3arc()
    .startAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x0))))
    .endAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x1))))
    .innerRadius(d => y(d.y0))
    .outerRadius(d => y(d.y1));

  return html`
    <${SunBurst}
      layout=${layout}
      root=${root}
      size=${size}
      radius=${radius}
      arc=${arc}
      onNodeHover=${node => {
        setTooltipNode(node);
        setHighlightedNodes(node.ancestors());
      }}
      highlightedNodes=${highlightedNodes}
    />
    <${Tooltip} node=${tooltipNode} root=${root} />
  `;
};

const drawChart = (parentNode, { tree, nodes }, width, height) => {
  const size = Math.min(width, height);

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

      node.originalValue = sum;
      node.value = sum;
    })
    .sort((a, b) => b.originalValue - a.originalValue);

  const layout = d3partition();

  render(
    html`
      <${Chart} root=${root} size=${size} layout=${layout} />
    `,
    parentNode
  );
};

export default drawChart;
