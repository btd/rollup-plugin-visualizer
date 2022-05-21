/* eslint-disable react/no-unknown-property */
import { FunctionalComponent } from "preact";
import { useContext, useRef, useState } from "preact/hooks";
import { NetworkLink, NetworkNode, StaticContext } from ".";

export interface NetworkProps {
  onNodeHover: (event: NetworkNode) => void;
  nodes: NetworkNode[];
  links: NetworkLink[];
  viewport: [number, number];
}

const noEvent = (event: UIEvent) => {
  event.preventDefault();
  event.stopImmediatePropagation();
};

export const Network: FunctionalComponent<NetworkProps> = ({ links, nodes, onNodeHover }) => {
  const { width, height } = useContext(StaticContext);

  const [viewportX, setViewportX] = useState(0);
  const [viewportY, setViewportY] = useState(0);

  const prevPosRef = useRef<[number, number]>();
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (event: MouseEvent) => {
    if (event.ctrlKey || event.button) {
      // context menu
      return;
    }

    noEvent(event);

    prevPosRef.current = [event.clientX, event.clientY];
    setDragging(true);
  };

  const handleMouseMove = (event: MouseEvent) => {
    noEvent(event);

    if (!dragging) {
      return;
    }

    const prevPos = prevPosRef.current ?? [event.clientX, event.clientY];
    const dx = event.clientX - prevPos[0];
    const dy = event.clientY - prevPos[1];

    prevPosRef.current = [event.clientX, event.clientY];

    setViewportX(viewportX - dx);
    setViewportY(viewportY - dy);
  };

  const handleMouseUp = (event: MouseEvent) => {
    noEvent(event);
    if (!dragging) {
      return;
    }
    setDragging(false);
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${viewportX} ${viewportY} ${viewportX + width} ${viewportY + height}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <g stroke="#fff" stroke-opacity="0.9">
        {links.map((link) => {
          return (
            <line
              key={`${link.source.uid} - ${link.target.uid}`}
              stroke-width="1"
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
            />
          );
        })}
      </g>
      <g stroke="#fff" stroke-width="1.5">
        {nodes.map((node) => {
          return (
            <circle
              key={node.uid}
              r={node.radius}
              fill={node.color}
              cx={node.x}
              cy={node.y}
              onMouseOver={(evt) => {
                evt.stopPropagation();
                onNodeHover(node);
              }}
            />
          );
        })}
      </g>
    </svg>
  );
};
