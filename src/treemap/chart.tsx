import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";
import { HierarchyRectangularNode } from "d3-hierarchy";

import { TreeMap } from "./treemap";
import { Tooltip } from "./tooltip";
import { ModuleTree, ModuleTreeLeaf, SizeKey } from "../../types/types";

export interface ChartProps {
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
  selectedNode: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined;
  setSelectedNode: (node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined) => void;
}

export const Chart: FunctionalComponent<ChartProps> = ({ root, sizeProperty, selectedNode, setSelectedNode }) => {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [tooltipNode, setTooltipNode] = useState<HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined>(
    undefined
  );

  useEffect(() => {
    const handleMouseOut = () => {
      setShowTooltip(false);
    };

    document.addEventListener("mouseover", handleMouseOut);
    return () => {
      document.removeEventListener("mouseover", handleMouseOut);
    };
  }, []);

  return (
    <>
      <TreeMap
        root={root}
        onNodeHover={(node) => {
          setTooltipNode(node);
          setShowTooltip(true);
        }}
        selectedNode={selectedNode}
        onNodeClick={(node) => {
          setSelectedNode(selectedNode === node ? undefined : node);
        }}
        sizeProperty={sizeProperty}
      />
      <Tooltip visible={showTooltip} node={tooltipNode} root={root} sizeProperty={sizeProperty} />
    </>
  );
};
