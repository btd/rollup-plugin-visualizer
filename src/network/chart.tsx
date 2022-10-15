import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";

import { Tooltip } from "./tooltip";
import { Network } from "./network";
import { NodeColorGetter } from "./color";
import { NetworkLink, NetworkNode } from ".";

export interface ChartProps {
  links: NetworkLink[];
  nodes: NetworkNode[];
  onNodeExclude: (node: NetworkNode) => void;
  getColor: NodeColorGetter;
  onNodeSelect: (node: string | undefined) => void;
}

export const Chart: FunctionalComponent<ChartProps> = ({
  links,
  nodes,
  onNodeExclude,
  getColor,
  onNodeSelect,
}) => {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [tooltipNode, setTooltipNode] = useState<NetworkNode | undefined>(undefined);

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
      <Network
        links={links}
        nodes={nodes}
        onNodeHover={(node) => {
          setTooltipNode(node);
          setShowTooltip(true);
        }}
        onNodeDblClick={onNodeExclude}
        onNodeClick={(node) => onNodeSelect(node.uid)}
        onCanvasClick={() => {
          onNodeSelect(undefined);
        }}
        getColor={getColor}
      />
      <Tooltip visible={showTooltip} node={tooltipNode} />
    </>
  );
};
