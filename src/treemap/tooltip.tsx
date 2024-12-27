import { useState, useRef, useEffect, useMemo, useContext } from "preact/hooks";

import { format as formatBytes } from "bytes";

import { FunctionalComponent } from "preact";
import { HierarchyRectangularNode } from "d3-hierarchy";
import { LABELS } from "../sizes";
import { isModuleTree, ModuleTree, ModuleTreeLeaf, SizeKey } from "../../shared/types";
import { StaticContext } from ".";

export interface TooltipProps {
  node?: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
  visible: boolean;
}

const Tooltip_marginX = 10;
const Tooltip_marginY = 30;

const SOURCEMAP_RENDERED = (
  <span>
    {" "}
    <b>{LABELS.renderedLength}</b> is a number of characters in the file after individual and <br />{" "}
    whole bundle transformations according to sourcemap.
  </span>
);

const RENDRED = (
  <span>
    <b>{LABELS.renderedLength}</b> is a byte size of individual file after transformations and
    treeshake.
  </span>
);

const COMPRESSED = (
  <span>
    <b>{LABELS.gzipLength}</b> and <b>{LABELS.brotliLength}</b> is a byte size of individual file
    after individual transformations,
    <br /> treeshake and compression.
  </span>
);

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

    const percentageNum = (100 * mainSize) / getModuleSize(root.data, sizeProperty);
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    const path = node
      .ancestors()
      .reverse()
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
        <br />
        <small>{data.options.sourcemap ? SOURCEMAP_RENDERED : RENDRED}</small>
        {(data.options.gzip || data.options.brotli) && (
          <>
            <br />
            <small>{COMPRESSED}</small>
          </>
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
      // Shifting horizontally
      pos.left = Math.max(0,window.innerWidth - boundingRect.width);
    }

    if (pos.top + boundingRect.height > window.innerHeight) {
      // Flipping vertically
      pos.top = Math.max(0,mouseCoords.y - Tooltip_marginY - boundingRect.height);
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
