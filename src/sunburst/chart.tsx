import { FunctionalComponent } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";

import { HierarchyRectangularNode } from "d3-hierarchy";
import { ModuleTree, ModuleTreeLeaf, SizeKey } from "../../shared/types";
import { Tooltip } from "./tooltip";
import { SunBurst } from "./sunburst";

export interface ChartProps {
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
  selectedNode: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined;
  setSelectedNode: (
    node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined
  ) => void;
}

type NodeSelectHandler = (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => boolean;

export const Chart: FunctionalComponent<ChartProps> = ({
  root,
  sizeProperty,
  selectedNode,
  setSelectedNode,
}) => {
  const [tooltipNode, setTooltipNode] = useState(root);

  const isNodeHighlighted = useMemo<NodeSelectHandler>(() => {
    const highlightedNodes = new Set(
      tooltipNode === root ? root.descendants() : tooltipNode.ancestors()
    );
    return (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>): boolean => {
      return highlightedNodes.has(node);
    };
  }, [root, tooltipNode]);

  useEffect(() => {
    const handleMouseOut = () => {
      setTooltipNode(root);
    };

    handleMouseOut();
    document.addEventListener("mouseover", handleMouseOut);
    return () => {
      document.removeEventListener("mouseover", handleMouseOut);
    };
  }, [root]);

  return (
    <>
      <SunBurst
        root={root}
        onNodeHover={(node) => {
          setTooltipNode(node);
        }}
        isNodeHighlighted={isNodeHighlighted}
        selectedNode={selectedNode}
        onNodeClick={(node) => {
          setSelectedNode(selectedNode === node ? undefined : node);
        }}
      />
      <Tooltip node={tooltipNode} root={root} sizeProperty={sizeProperty} />
    </>
  );
};
