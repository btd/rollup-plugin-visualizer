import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";
import webcola from "webcola";

import { SizeKey } from "../../types/types";
import { Tooltip } from "./tooltip";
import { Network } from "./network";
import { NetworkLink, NetworkNode } from ".";

export interface ChartProps {
  sizeProperty: SizeKey;
  links: NetworkLink[];
  nodes: NetworkNode[];
  groups: Record<string, webcola.Group>;
}

export const Chart: FunctionalComponent<ChartProps> = ({ sizeProperty, links, nodes, groups }) => {
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
        groups={groups}
        onNodeHover={(node) => {
          setTooltipNode(node);
          setShowTooltip(true);
        }}
      />
      <Tooltip visible={showTooltip} node={tooltipNode} sizeProperty={sizeProperty} />
    </>
  );
};
