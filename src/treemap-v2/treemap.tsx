import { FunctionalComponent } from "preact";
import { useMemo } from "preact/hooks";
import { group } from "d3-array";
import { HierarchyNode, HierarchyRectangularNode } from "d3-hierarchy";

import type { OutputNode } from "./data";
import { Node } from "./node";
import { useTreeMapContext } from "./context";

export interface TreeMapProps {
  root: HierarchyRectangularNode<OutputNode>;
  onNodeHover: (event: HierarchyRectangularNode<OutputNode>) => void;
  isSelected: (node: OutputNode) => boolean;
  moduleId: (node: OutputNode) => string | undefined;
  onNodeClick: (node: HierarchyRectangularNode<OutputNode>) => void;
}

export const TreeMap: FunctionalComponent<TreeMapProps> = ({
  root,
  onNodeHover,
  isSelected,
  moduleId,
  onNodeClick,
}) => {
  const { width, height } = useTreeMapContext();

  // this will make groups by height
  const nestedData = useMemo(() => {
    const nestedDataMap = group(root.descendants(), (d: HierarchyNode<OutputNode>) => d.height);
    const nestedDataKV = Array.from(nestedDataMap, ([key, values]) => ({
      key,
      values,
    }));
    nestedDataKV.sort((a, b) => b.key - a.key);
    return nestedDataKV;
  }, [root]);

  return (
    <svg
      role="img"
      aria-label="Module sizes. Click to inspect; double-click a group to zoom."
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
    >
      {root.value !== 0 &&
        nestedData.map(({ key, values }) => {
          return (
            <g className="layer" key={key}>
              {values.map((node) => {
                return (
                  <Node
                    key={node.data.key}
                    node={node}
                    onMouseOver={onNodeHover}
                    selected={isSelected(node.data)}
                    moduleId={moduleId(node.data)}
                    onClick={onNodeClick}
                  />
                );
              })}
            </g>
          );
        })}
    </svg>
  );
};
