import { FunctionalComponent } from "preact";
import { useCallback, useState } from "preact/hooks";
import { HierarchyRectangularNode } from "d3-hierarchy";

import { ModuleTree, ModuleTreeLeaf, SizeKey } from "../../shared/types";
import { Treemap3DScene } from "./scene";
import { Tooltip } from "./tooltip";

export interface ChartProps {
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
  selectedNode: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined;
  setSelectedNode: (
    node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined,
  ) => void;
}

export const Chart: FunctionalComponent<ChartProps> = ({
  root,
  sizeProperty,
  selectedNode,
  setSelectedNode,
}) => {
  const [tooltipNode, setTooltipNode] = useState<
    HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined
  >(undefined);

  const handleNodeHover = useCallback(
    (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined) => {
      setTooltipNode(node);
    },
    [],
  );

  const handleNodeClick = useCallback(
    (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => {
      setSelectedNode(selectedNode === node ? undefined : node);
    },
    [selectedNode, setSelectedNode],
  );

  return (
    <>
      <Treemap3DScene
        root={root}
        sizeProperty={sizeProperty}
        selectedNode={selectedNode}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
      />

      <Tooltip
        visible={tooltipNode != null}
        node={tooltipNode}
        root={root}
        sizeProperty={sizeProperty}
      />
    </>
  );
};
