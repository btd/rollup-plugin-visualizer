import { useState, useRef, useEffect, useMemo } from "preact/hooks";
import { html } from "htm/preact";

import { format as formatBytes } from "bytes";

import { LABELS } from "../sizes";

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

export default Tooltip;
