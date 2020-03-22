import { render } from "preact";
import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { html } from "htm/preact";
import { max as d3max } from "d3-array";
import { scaleSqrt } from "d3-scale";

import { format as formatBytes } from "bytes";

import webcola from "webcola";

import {
  COLOR_DEFAULT_OWN_SOURCE,
  COLOR_DEFAULT_VENDOR_SOURCE,
  COLOR_BASE,
} from "./color";

import { LABELS, getAvailableSizeOptions } from "./sizes";

import "./style/style-network.scss";

const NODE_MODULES = /.*(?:\/|\\\\)?node_modules(?:\/|\\\\)([^/\\]+)(?:\/|\\\\).+/;

const color = ({ renderedLength, id }) =>
  renderedLength === 0
    ? COLOR_BASE
    : id.match(NODE_MODULES)
    ? COLOR_DEFAULT_VENDOR_SOURCE
    : COLOR_DEFAULT_OWN_SOURCE;

const Tooltip = ({
  node,
  visible,
  importedByCache,
  sizeProperty,
  availableSizeProperties,
}) => {
  const ref = useRef();
  const [style, setStyle] = useState({});
  const content = useMemo(() => {
    if (!node) return null;

    const uid = node.uid;

    return html`
      <div>${node.id}</div>
      ${availableSizeProperties.map((sizeProp) => {
        if (sizeProp === sizeProperty) {
          return html`
            <div>
              <b>${LABELS[sizeProp]}:${" "}${formatBytes(node[sizeProp])}</b>
            </div>
          `;
        } else {
          return html`
            <div>
              ${LABELS[sizeProp]}:${" "} ${formatBytes(node[sizeProp])}
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

const Network = ({
  width,
  height,
  links,
  nodes,
  size,
  onNodeHover,
  sizeProperty,
}) => {
  return html`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox=${`0 0 ${width} ${height}`}>
      <g stroke="#999" stroke-opacity="0.6">
        ${links.map((link) => {
          return html`
            <line
              stroke-width="1"
              x1=${link.source.x}
              y1=${link.source.y}
              x2=${link.target.x}
              y2=${link.target.y}
            />
          `;
        })}
      </g>
      <g stroke="#fff" stroke-width="1.5">
        ${nodes.map((node) => {
          return html`
            <circle
              r=${size(node[sizeProperty])}
              fill=${color(node)}
              cx=${node.x}
              cy=${node.y}
              onMouseOver=${(evt) => {
                evt.stopPropagation();
                onNodeHover(node);
              }}
            />
          `;
        })}
      </g>
    </svg>
  `;
};

const Chart = ({
  width,
  height,
  nodes,
  links,
  size,
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
    <${Network}
      width=${width}
      height=${height}
      links=${links}
      nodes=${nodes}
      size=${size}
      onNodeHover=${(node) => {
        setTooltipNode(node);
        setShowTooltip(true);
      }}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
    />
    <${Tooltip}
      visible=${showTooltip}
      node=${tooltipNode}
      importedByCache=${importedByCache}
      importedCache=${importedCache}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
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
  data: { nodes: origNodes, links: origLinks, options },
}) => {
  const availableSizeProperties = getAvailableSizeOptions(options);

  const [sizeProperty, setSizeProperty] = useState(availableSizeProperties[0]);

  console.time("size scale");
  const maxLines = d3max(Object.values(origNodes), (d) => d[sizeProperty]);
  const size = scaleSqrt().domain([1, maxLines]).range([5, 30]);
  console.timeEnd("size scale");

  console.time("nodes & links");
  const nodes = Object.entries(origNodes).map(([uid, node]) => {
    const radius = size(node[sizeProperty]) + 1;
    return {
      uid,
      ...node,
      width: radius * 2,
      height: radius * 2,
      radius,
    };
  });
  const nodesCache = new Map(nodes.map((d) => [d.uid, d]));
  const links = origLinks.map(({ source, target }) => ({
    source: nodesCache.get(source),
    target: nodesCache.get(target),
    value: 1,
  }));
  console.timeEnd("nodes & links");

  console.time("constraints");
  const cola = webcola.adaptor({}).size([width, height]);

  const paddingX = 50;
  const paddingY = 50;

  const pageBounds = {
    x: paddingX,
    y: paddingY,
    width: width - paddingX,
    height: height - paddingY,
  };

  const realGraphNodes = nodes.slice(0);
  const topLeft = { x: pageBounds.x, y: pageBounds.y, fixed: true };
  const tlIndex = nodes.push(topLeft) - 1;
  const bottomRight = {
    x: pageBounds.x + pageBounds.width,
    y: pageBounds.y + pageBounds.height,
    fixed: true,
  };
  const brIndex = nodes.push(bottomRight) - 1;
  const constraints = [];
  for (let i = 0; i < realGraphNodes.length; i++) {
    const node = realGraphNodes[i];
    constraints.push({
      axis: "x",
      type: "separation",
      left: tlIndex,
      right: i,
      gap: node.radius,
    });
    constraints.push({
      axis: "y",
      type: "separation",
      left: tlIndex,
      right: i,
      gap: node.radius,
    });
    constraints.push({
      axis: "x",
      type: "separation",
      left: i,
      right: brIndex,
      gap: node.radius,
    });
    constraints.push({
      axis: "y",
      type: "separation",
      left: i,
      right: brIndex,
      gap: node.radius,
    });
  }
  console.timeEnd("constraints");

  console.time("cola");
  cola
    .nodes(nodes)
    .links(links)
    .constraints(constraints)
    .jaccardLinkLengths(50, 0.7)
    .avoidOverlaps(true)
    .start(50, 50, 50)
    .stop();

  console.timeEnd("cola");
  const importedByCache = new Map();
  const importedCache = new Map();

  for (const { source, target } of origLinks || []) {
    if (!importedByCache.has(target)) {
      importedByCache.set(target, []);
    }
    if (!importedCache.has(source)) {
      importedCache.set(source, []);
    }

    importedByCache.get(target).push({ uid: source, ...origNodes[source] });
    importedCache.get(source).push({ uid: target, ...origNodes[target] });
  }

  return html`
    <${SideBar}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
      setSizeProperty=${setSizeProperty}
    />
    <${Chart}
      nodes=${realGraphNodes}
      links=${links}
      size=${size}
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
