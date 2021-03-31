import { FunctionalComponent } from "preact";
import { useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { format as formatBytes } from "bytes";
import { StaticContext, NetworkNode } from ".";
import { LABELS } from "../sizes";
import { SizeKey } from "../../types/types";

export interface TooltipProps {
  node?: NetworkNode;
  sizeProperty: SizeKey;
  visible: boolean;
}

const Tooltip_marginX = 10;
const Tooltip_marginY = 30;

export const Tooltip: FunctionalComponent<TooltipProps> = ({ node, visible, sizeProperty }) => {
  const { availableSizeProperties, importedByCache } = useContext(StaticContext);

  const ref = useRef<HTMLDivElement>();
  const [style, setStyle] = useState({});
  const content = useMemo(() => {
    if (!node) return null;

    return (
      <>
        <div>{node.id}</div>
        {availableSizeProperties.map((sizeProp) => {
          if (sizeProp === sizeProperty) {
            return (
              <div>
                <b>
                  {LABELS[sizeProp]}: {formatBytes(node[sizeProp] ?? 0)}
                </b>
              </div>
            );
          } else {
            return (
              <div>
                {LABELS[sizeProp]}: {formatBytes(node[sizeProp] ?? 0)}
              </div>
            );
          }
        })}
        {node.uid && importedByCache.has(node.uid) && (
          <div>
            <div>
              <b>Imported By</b>:
            </div>
            {[...new Set(importedByCache.get(node.uid)?.map(({ id }) => id))].map((id) => (
              <div key={id}>{id}</div>
            ))}
          </div>
        )}
      </>
    );
  }, [availableSizeProperties, importedByCache, node, sizeProperty]);

  const updatePosition = (mouseCoords: { x: number; y: number }) => {
    const pos = {
      left: mouseCoords.x + Tooltip_marginX,
      top: mouseCoords.y + Tooltip_marginY,
    };

    const boundingRect = ref.current.getBoundingClientRect();

    if (pos.left + boundingRect.width > window.innerWidth) {
      // Shifting horizontally
      pos.left = window.innerWidth - boundingRect.width;
    }

    if (pos.top + boundingRect.height > window.innerHeight) {
      // Flipping vertically
      pos.top = mouseCoords.y - Tooltip_marginY - boundingRect.height;
    }

    setStyle(pos);
  };

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      updatePosition({
        x: event.pageX,
        y: event.pageY,
      });
    };

    document.addEventListener("mousemove", handleMouseMove, true);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove, true);
    };
  }, []);

  return (
    <div className={`tooltip ${visible ? "" : "tooltip-hidden"}`} ref={ref} style={style}>
      {content}
    </div>
  );
};
