import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";

import { SizeKey } from "../../types/types";
import { Tooltip } from "./tooltip";
import { Network } from "./network";
import { NetworkLink, NetworkNode } from ".";

export interface ChartProps {
  sizeProperty: SizeKey;
  links: NetworkLink[];
  nodes: NetworkNode[];
  viewport: [number, number];
}

export const Chart: FunctionalComponent<ChartProps> = ({ sizeProperty, links, nodes, viewport }) => {
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
        viewport={viewport}
      />
      <Tooltip visible={showTooltip} node={tooltipNode} sizeProperty={sizeProperty} />
    </>
  );
};
