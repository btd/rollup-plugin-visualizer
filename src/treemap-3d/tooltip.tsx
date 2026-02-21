import { useState, useRef, useEffect, useMemo, useContext } from "preact/hooks";

import { format as formatBytes } from "bytes";

import { FunctionalComponent } from "preact";
import { HierarchyRectangularNode } from "d3-hierarchy";
import { LABELS } from "../sizes";
import { isModuleTree, ModuleTree, ModuleTreeLeaf, SizeKey } from "../../shared/types";
import { StaticContext } from "./index";

export interface TooltipProps {
  node?: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
  visible: boolean;
}

const Tooltip_marginX = 10;
const Tooltip_marginY = 30;

export const Tooltip: FunctionalComponent<TooltipProps> = ({
  node,
  visible,
  root,
  sizeProperty,
}) => {
  const { availableSizeProperties, getModuleSize, data } = useContext(StaticContext);

  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState({});

  const content = useMemo(() => {
    if (!node) return null;

    const mainSize = getModuleSize(node.data, sizeProperty);

    const percentageNum = (100 * mainSize) / Math.max(getModuleSize(root.data, sizeProperty), 1);
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    const path = node
      .ancestors()
      .toReversed()
      .map((d) => d.data.name)
      .join("/");

    let dataNode = null;
    if (!isModuleTree(node.data)) {
      const mainUid = data.nodeParts[node.data.uid].metaUid;
      dataNode = data.nodeMetas[mainUid];
    }

    return (
      <>
        <div>{path}</div>
        {availableSizeProperties.map((sizeProp) => {
          if (sizeProp === sizeProperty) {
            return (
              <div key={sizeProp}>
                <b>
                  {LABELS[sizeProp]}: {formatBytes(mainSize)}
                </b>{" "}
                ({percentageString})
              </div>
            );
          } else {
            return (
              <div key={sizeProp}>
                {LABELS[sizeProp]}: {formatBytes(getModuleSize(node.data, sizeProp))}
              </div>
            );
          }
        })}
        <br />
        {dataNode && dataNode.importedBy.length > 0 && (
          <div>
            <div>
              <b>Imported By</b>:
            </div>
            {dataNode.importedBy.map(({ uid }) => {
              const id = data.nodeMetas[uid].id;
              return <div key={id}>{id}</div>;
            })}
          </div>
        )}
      </>
    );
  }, [availableSizeProperties, data, getModuleSize, node, root.data, sizeProperty]);

  const updatePosition = (mouseCoords: { x: number; y: number }) => {
    if (!ref.current) return;

    const pos = {
      left: mouseCoords.x + Tooltip_marginX,
      top: mouseCoords.y + Tooltip_marginY,
    };

    const boundingRect = ref.current.getBoundingClientRect();

    if (pos.left + boundingRect.width > window.innerWidth) {
      pos.left = Math.max(0, window.innerWidth - boundingRect.width);
    }

    if (pos.top + boundingRect.height > window.innerHeight) {
      pos.top = Math.max(0, mouseCoords.y - Tooltip_marginY - boundingRect.height);
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
