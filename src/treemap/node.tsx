/* eslint-disable react/no-unknown-property */
import { FunctionalComponent } from "preact";
import { useContext } from "preact/hooks";
import { format as formatBytes } from "bytes";
import { HierarchyRectangularNode } from "d3-hierarchy";
import { ModuleTree, ModuleTreeLeaf, SizeKey } from "../../types/types";
import { StaticContext } from ".";

type NodeEventHandler = (event: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => void;

export interface NodeProps {
  node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  onMouseOver: NodeEventHandler;
  selected: boolean;
  onClick: NodeEventHandler;
  sizeProperty: SizeKey;
}

interface tspanProps {
  x?: number | string;
  y?: number | string;
  dx?: number;
  dy?: number;
}

export const Node: FunctionalComponent<NodeProps> = ({ node, onMouseOver, onClick, selected, sizeProperty }) => {
  const { getModuleColor, getModuleIds, getModuleSize } = useContext(StaticContext);
  const { backgroundColor, fontColor } = getModuleColor(node);
  const { clipUid, nodeUid } = getModuleIds(node.data);
  const { x0, x1, y1, y0, data, children = null } = node;

  const tspan1Props: tspanProps = {};
  const tspan2Props: tspanProps = {};
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

  const handleClickSelection = (event: MouseEvent) => {
    if (window.getSelection()?.toString() !== "") {
      event.stopPropagation();
    }
  };

  return (
    <g
      className="node"
      transform={`translate(${x0},${y0})`}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick(node);
      }}
      onMouseOver={(evt: MouseEvent) => {
        evt.stopPropagation();
        onMouseOver(node);
      }}
    >
      <rect
        id={nodeUid.id}
        fill={backgroundColor}
        rx={2}
        ry={2}
        width={x1 - x0}
        height={y1 - y0}
        stroke={selected ? "#fff" : undefined}
        stroke-width={selected ? 2 : undefined}
      ></rect>
      <clipPath id={clipUid.id}>
        <use href={nodeUid.href} />
      </clipPath>
      <text clip-path={clipUid} fill={fontColor} onClick={handleClickSelection}>
        <tspan {...tspan1Props} font-size="0.7em">
          {data.name}
        </tspan>
        <tspan {...tspan2Props} fill-opacity={0.7} font-size="0.7em">
          {formatBytes(getModuleSize(data, sizeProperty))}
        </tspan>
      </text>
    </g>
  );
};
