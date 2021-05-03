import { FunctionalComponent } from "preact";
import { useContext, useMemo } from "preact/hooks";
import { group } from "d3-array";
import { HierarchyNode, HierarchyRectangularNode } from "d3-hierarchy";

import { ModuleTree, ModuleTreeLeaf } from "../../types/types";
import { Node } from "./node";
import { StaticContext } from "./index";

export interface TreeMapProps {
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  onNodeHover: (event: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => void;
  selectedNode: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined;
  onNodeClick: (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => void;
}

export const TreeMap: FunctionalComponent<TreeMapProps> = ({ root, onNodeHover, selectedNode, onNodeClick }) => {
  const { width, height, getModuleIds } = useContext(StaticContext);

  console.time("layering");
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
  console.timeEnd("layering");

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
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};
