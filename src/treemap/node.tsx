/* eslint-disable react/no-unknown-property */
import { FunctionalComponent } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";
import { HierarchyRectangularNode } from "d3-hierarchy";
import { ModuleTree, ModuleTreeLeaf } from "../../shared/types";
import { PADDING, TOP_PADDING } from "./const";
import { StaticContext } from ".";

type NodeEventHandler = (event: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>) => void;

export interface NodeProps {
  node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  onMouseOver: NodeEventHandler;
  selected: boolean;
  onClick: NodeEventHandler;
}

export const Node: FunctionalComponent<NodeProps> = ({ node, onMouseOver, onClick, selected }) => {
  const { getModuleColor } = useContext(StaticContext);
  const { backgroundColor, fontColor } = getModuleColor(node);
  const { x0, x1, y1, y0, data, children = null } = node;

  const textRef = useRef<SVGTextElement>(null);
  const textRectRef = useRef<DOMRect>();

  const width = x1 - x0;
  const height = y1 - y0;

  const textProps: Record<string, number | string | null | undefined> = {
    "font-size": "0.7em",
    "dominant-baseline": "middle",
    "text-anchor": "middle",
    x: width / 2,
  };
  if (children != null) {
    textProps.y = (TOP_PADDING + PADDING) / 2;
  } else {
    textProps.y = height / 2;
  }

  useLayoutEffect(() => {
    if (width == 0 || height == 0 || !textRef.current) {
      return;
    }

    if (textRectRef.current == null) {
      textRectRef.current = textRef.current.getBoundingClientRect();
    }

    let scale = 1;
    if (children != null) {
      scale = Math.min(
        (width * 0.9) / textRectRef.current.width,
        Math.min(height, TOP_PADDING + PADDING) / textRectRef.current.height,
      );
      scale = Math.min(1, scale);
      textRef.current.setAttribute(
        "y",
        String(Math.min(TOP_PADDING + PADDING, height) / 2 / scale),
      );
      textRef.current.setAttribute("x", String(width / 2 / scale));
    } else {
      scale = Math.min(
        (width * 0.9) / textRectRef.current.width,
        (height * 0.9) / textRectRef.current.height,
      );
      scale = Math.min(1, scale);
      textRef.current.setAttribute("y", String(height / 2 / scale));
      textRef.current.setAttribute("x", String(width / 2 / scale));
    }

    textRef.current.setAttribute("transform", `scale(${scale.toFixed(2)})`);
  }, [children, height, width]);

  if (width == 0 || height == 0) {
    return null;
  }

  return (
    <g
      className="node"
      transform={`translate(${x0},${y0})`}
      onClick={(event: MouseEvent) => {
        event.stopPropagation();
        onClick(node);
      }}
      onMouseOver={(event: MouseEvent) => {
        event.stopPropagation();
        onMouseOver(node);
      }}
    >
      <rect
        fill={backgroundColor}
        rx={2}
        ry={2}
        width={x1 - x0}
        height={y1 - y0}
        stroke={selected ? "#fff" : undefined}
        stroke-width={selected ? 2 : undefined}
      ></rect>
      <text
        ref={textRef}
        fill={fontColor}
        onClick={(event: MouseEvent) => {
          if (window.getSelection()?.toString() !== "") {
            event.stopPropagation();
          }
        }}
        {...textProps}
      >
        {data.name}
      </text>
    </g>
  );
};
