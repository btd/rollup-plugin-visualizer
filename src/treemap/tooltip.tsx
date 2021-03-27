import { useState, useRef, useEffect, useMemo, useContext } from "preact/hooks";

import { format as formatBytes } from "bytes";

import { LABELS } from "../sizes";
import { FunctionalComponent } from "preact";
import { HierarchyRectangularNode } from "d3-hierarchy";
import { isModuleTree, ModuleTree, ModuleTreeLeaf, SizeKey } from "../../types/types";
import { StaticContext } from ".";

export interface TooltipProps {
  node?: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
  visible: boolean;
}

const Tooltip_marginX = 10;
const Tooltip_marginY = 30;

export const Tooltip: FunctionalComponent<TooltipProps> = ({ node, visible, root, sizeProperty }) => {
  const { availableSizeProperties, getModuleSize, importedByCache } = useContext(StaticContext);

  const ref = useRef<HTMLDivElement>();
  const [style, setStyle] = useState({});
  const content = useMemo(() => {
    if (!node) return null;

    const mainSize = getModuleSize(node.data, sizeProperty);

    const percentageNum = (100 * mainSize) / getModuleSize(root.data, sizeProperty);
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    const path = node
      .ancestors()
      .reverse()
      .map((d) => d.data.name)
      .join("/");

    return (
      <>
        <div>{path}</div>
        {availableSizeProperties.map((sizeProp) => {
          if (sizeProp === sizeProperty) {
            return (
              <div>
                <b>
                  {LABELS[sizeProp]}: {formatBytes(mainSize)}
                </b>{" "}
                ({percentageString})
              </div>
            );
          } else {
            return (
              <div>
                {LABELS[sizeProp]}: {formatBytes(getModuleSize(node.data, sizeProp))}
              </div>
            );
          }
        })}
        {!isModuleTree(node.data) && importedByCache.has(node.data.uid) && (
          <div>
            <div>
              <b>Imported By</b>:
            </div>
            {[...new Set(importedByCache.get(node.data.uid)?.map(({ id }) => id))].map((id) => (
              <div key={id}>{id}</div>
            ))}
          </div>
        )}
      </>
    );
  }, [availableSizeProperties, getModuleSize, importedByCache, node, root.data, sizeProperty]);

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

export default Tooltip;
