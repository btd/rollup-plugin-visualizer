import { render } from "preact";
import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { html } from "htm/preact";
import { group } from "d3-array";
import {
  hierarchy as d3hierarchy,
  treemap as d3treemap,
  treemapResquarify,
} from "d3-hierarchy";

import { format as formatBytes } from "bytes";

import uid from "./uid";
import { createRainbowColor } from "./color";

import { LABELS, getAvailableSizeOptions } from "./sizes";

import "./style/style-treemap.scss";

const Tooltip = ({
  node,
  visible,
  root,
  sizeProperty,
  availableSizeProperties,
  importedByCache,
}) => {
  const ref = useRef();
  const [style, setStyle] = useState({});
  const content = useMemo(() => {
    if (!node) return null;

    const mainSize = node.originalValue[sizeProperty];

    const percentageNum = (100 * mainSize) / root.originalValue[sizeProperty];
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    const uid = node.data.uid;

    const path = node
      .ancestors()
      .reverse()
      .map((d) => d.data.name)
      .join("/");

    return html`
      <div>${path}</div>
      ${availableSizeProperties.map((sizeProp) => {
        if (sizeProp === sizeProperty) {
          return html`
            <div>
              <b>${LABELS[sizeProp]}:${" "}${formatBytes(mainSize)}</b
              >${" "}(${percentageString})
            </div>
          `;
        } else {
          return html`
            <div>
              ${LABELS[sizeProp]}:${" "}
              ${formatBytes(node.originalValue[sizeProp])}
            </div>
          `;
        }
      })}
      ${uid &&
      importedByCache.has(uid) &&
      html`
        <div>
          <div><b>Imported By</b>:</div>
          ${[...new Set(importedByCache.get(uid).map(({ id }) => id))].map(
            (id) => html` <div>${id}</div> `
          )}
        </div>
      `}
    `;
  }, [node]);

  const updatePosition = (mouseCoords) => {
    const pos = {
      left: mouseCoords.x + Tooltip.marginX,
      top: mouseCoords.y + Tooltip.marginY,
    };

    const boundingRect = ref.current.getBoundingClientRect();

    if (pos.left + boundingRect.width > window.innerWidth) {
      // Shifting horizontally
      pos.left = window.innerWidth - boundingRect.width;
    }

    if (pos.top + boundingRect.height > window.innerHeight) {
      // Flipping vertically
      pos.top = mouseCoords.y - Tooltip.marginY - boundingRect.height;
    }

    setStyle(pos);
  };

  const handleMouseMove = (event) => {
    updatePosition({
      x: event.pageX,
      y: event.pageY,
    });
  };

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove, true);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
    };
  }, []);

  return html`
    <div
      class="tooltip ${visible ? "" : "tooltip-hidden"}"
      ref=${ref}
      style=${style}
    >
      ${content}
    </div>
  `;
};

Tooltip.marginX = 10;
Tooltip.marginY = 30;

const Node = ({
  node,
  backgroundColor,
  fontColor,
  onClick,
  isSelected,
  onNodeHover,
  sizeProperty,
}) => {
  const {
    nodeUid,
    x0,
    x1,
    y1,
    y0,
    clipUid,
    data,
    originalValue,
    children = null,
  } = node;

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

  const handleClickSelection = (event) => {
    if (window.getSelection().toString() !== "") {
      event.stopPropagation();
    }
  };

  return html`
    <g
      class="node"
      transform="translate(${x0},${y0})"
      onClick=${onClick}
      onMouseOver=${(evt) => {
        evt.stopPropagation();
        onNodeHover(node);
      }}
    >
      <rect
        id=${nodeUid.id}
        fill=${backgroundColor}
        rx=${2}
        ry=${2}
        width=${x1 - x0}
        height=${y1 - y0}
        stroke=${isSelected ? "#fff" : null}
        stroke-width=${isSelected ? 2 : null}
      >
      </rect>
      <clipPath id=${clipUid.id}>
        <use xlink:href=${nodeUid.href} />
      </clipPath>
      <text
        clip-path=${clipUid}
        fill=${fontColor}
        onClick=${handleClickSelection}
      >
        <tspan ...${tspan1Props} font-size="0.7em">${data.name}</tspan>
        <tspan ...${tspan2Props} fill-opacity=${0.7} font-size="0.7em"
          >${formatBytes(originalValue[sizeProperty])}</tspan
        >
      </text>
    </g>
  `;
};

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

const Chart = ({
  layout,
  root,
  color,
  width,
  height,
  sizeProperty,
  availableSizeProperties,
  importedCache,
  importedByCache,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipNode, setTooltipNode] = useState(null);

  const handleMouseOut = () => {
    setShowTooltip(false);
  };

  useEffect(() => {
    document.addEventListener("mouseover", handleMouseOut);
    return () => {
      document.removeEventListener("mouseover", handleMouseOut);
    };
  }, []);

  return html`
    <${TreeMap}
      layout=${layout}
      root=${root}
      color=${color}
      width=${width}
      height=${height}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
      onNodeHover=${(node) => {
        setTooltipNode(node);
        setShowTooltip(true);
      }}
    />
    <${Tooltip}
      visible=${showTooltip}
      node=${tooltipNode}
      root=${root}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
      importedByCache=${importedByCache}
      importedCache=${importedCache}
    />
  `;
};

const SideBar = ({
  availableSizeProperties,
  sizeProperty,
  setSizeProperty,
}) => {
  const handleChange = (sizeProp) => () => {
    if (sizeProp !== sizeProperty) {
      setSizeProperty(sizeProp);
    }
  };
  return html`
    <aside class="sidebar">
      <div class="size-selectors">
        ${availableSizeProperties.length > 1 &&
        availableSizeProperties.map((sizeProp) => {
          const id = `selector-${sizeProp}`;
          return html`
            <div class="size-selector">
              <input
                type="radio"
                id=${id}
                checked=${sizeProp === sizeProperty}
                onChange=${handleChange(sizeProp)}
              />
              <label for=${id}>
                ${LABELS[sizeProp]}
              </label>
            </div>
          `;
        })}
      </div>
    </aside>
  `;
};

const Main = ({
  width,
  height,
  data: { tree, nodes, links, options = {} },
}) => {
  const availableSizeProperties = getAvailableSizeOptions(options);

  const [sizeProperty, setSizeProperty] = useState(availableSizeProperties[0]);

  const layout = d3treemap()
    .size([width, height])
    .paddingOuter(8)
    .paddingTop(20)
    .paddingInner(5)
    .round(true)
    .tile(treemapResquarify);

  const root = d3hierarchy(tree)
    .eachAfter((node) => {
      const value = {};
      for (const prop of availableSizeProperties) {
        value[prop] = 0;
      }

      // use node.data.children because if it is empty d3 will skip this node
      // and it will look like it is actually a leaf - which technically it is but not exactly
      // it is just a chunk without deps - usually just with imports
      if (node.data.children != null) {
        const children = node.children;
        let i = node.data.children.length;
        while (--i >= 0) {
          for (const prop of availableSizeProperties) {
            value[prop] += children[i].originalValue[prop] || 0;
          }
        }
      } else {
        for (const prop of availableSizeProperties) {
          value[prop] = nodes[node.data.uid][prop] || 0;
        }
      }

      node.clipUid = uid("clip");
      node.nodeUid = uid("node");

      node.originalValue = value;
      node.value = value[sizeProperty];
    })
    .sort(
      (a, b) => b.originalValue[sizeProperty] - a.originalValue[sizeProperty]
    );

  const color = createRainbowColor(root);

  const importedByCache = new Map();
  const importedCache = new Map();

  for (const { source, target } of links || []) {
    if (!importedByCache.has(target)) {
      importedByCache.set(target, []);
    }
    if (!importedCache.has(source)) {
      importedCache.set(source, []);
    }

    importedByCache.get(target).push({ uid: source, ...nodes[source] });
    importedCache.get(source).push({ uid: target, ...nodes[target] });
  }

  return html`
    <${SideBar}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
      setSizeProperty=${setSizeProperty}
    />
    <${Chart}
      layout=${layout}
      root=${root}
      color=${color}
      width=${width}
      height=${height}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
      importedByCache=${importedByCache}
      importedCache=${importedCache}
    />
  `;
};

const drawChart = (parentNode, data, width, height) => {
  render(
    html` <${Main} data=${data} width=${width} height=${height} /> `,
    parentNode
  );
};

export default drawChart;
