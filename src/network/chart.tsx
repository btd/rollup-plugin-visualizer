import { FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Tooltip } from "./tooltip";
import { Network, NetworkProps } from "./network";
import type { NetworkNode } from "./types";

export interface ChartProps extends Omit<
  NetworkProps,
  "onNodeHover" | "onNodeDblClick" | "onNodeClick" | "onCanvasClick"
> {
  onNodeExclude: (node: NetworkNode) => void;
  onNodeSelect: (node: string | undefined) => void;
}

export const Chart: FunctionalComponent<ChartProps> = ({
  onNodeExclude,
  onNodeSelect,
  ...props
}) => {
  const [tooltipNode, setTooltipNode] = useState<NetworkNode>();

  useEffect(() => {
    const hide = () => setTooltipNode(undefined);
    document.addEventListener("mouseover", hide);
    return () => document.removeEventListener("mouseover", hide);
  }, []);

  return (
    <>
      <Network
        {...props}
        onNodeHover={setTooltipNode}
        onNodeDblClick={(node) => {
          setTooltipNode(undefined);
          onNodeExclude(node);
        }}
        onNodeClick={(node) => onNodeSelect(node.uid)}
        onCanvasClick={() => onNodeSelect(undefined)}
      />
      <Tooltip
        visible={tooltipNode != null && props.nodes.includes(tooltipNode)}
        node={tooltipNode}
      />
    </>
  );
};
