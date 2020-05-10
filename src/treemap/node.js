import { html } from "htm/preact";

import { format as formatBytes } from "bytes";

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

export default Node;
