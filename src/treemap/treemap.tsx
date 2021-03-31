import { FunctionalComponent } from "preact";
import { useContext, useMemo } from "preact/hooks";
import { group } from "d3-array";
import { HierarchyNode, HierarchyRectangularNode } from "d3-hierarchy";

import { Node } from "./node";
import { StaticContext } from "./index";
import { ModuleTree, ModuleTreeLeaf, SizeKey } from "../../types/types";

export interface TreeMapProps {
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  onNodeHover: (event: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => void;
  selectedNode: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined;
  onNodeClick: (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => void;
  sizeProperty: SizeKey;
}

export const TreeMap: FunctionalComponent<TreeMapProps> = ({
  root,
  onNodeHover,
  selectedNode,
  onNodeClick,
  sizeProperty,
}) => {
  const { width, height, getModuleIds } = useContext(StaticContext);

  // this will make groups by height
  const nestedData = useMemo(() => {
    const nestedDataMap = group(root.descendants(), (d: HierarchyNode<ModuleTree | ModuleTreeLeaf>) => d.height);
    const nestedData = Array.from(nestedDataMap, ([key, values]) => ({
      key,
      values,
    }));
    nestedData.sort((a, b) => b.key - a.key);
    return nestedData;
  }, [root]);

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`}>
      {nestedData.map(({ key, values }) => {
        return (
          <g className="layer" key={key}>
            {values.map((node) => {
              return (
                <Node
                  key={getModuleIds(node.data).nodeUid.id}
                  node={node}
                  onMouseOver={onNodeHover}
                  selected={selectedNode === node}
                  onClick={onNodeClick}
                  sizeProperty={sizeProperty}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};
