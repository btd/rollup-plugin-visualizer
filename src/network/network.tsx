/* eslint-disable react/no-unknown-property */
import { FunctionalComponent } from "preact";
import { useContext, useRef, useState } from "preact/hooks";
import { identityTransform, Transform } from "./transform";
import { NetworkLink, NetworkNode, StaticContext } from ".";

export interface NetworkProps {
  onNodeHover: (node: NetworkNode) => void;
  onNodeDblClick: (node: NetworkNode) => void;
  nodes: NetworkNode[];
  links: NetworkLink[];
}

const noEvent = (event: UIEvent) => {
  event.preventDefault();
  event.stopImmediatePropagation();
};

const translate = (transform: Transform, p0: [number, number], p1: [number, number]) => {
  const x = p0[0] - p1[0] * transform.k,
    y = p0[1] - p1[1] * transform.k;
  return x === transform.x && y === transform.y ? transform : new Transform(transform.k, x, y);
};

export const Network: FunctionalComponent<NetworkProps> = ({ links, nodes, onNodeHover, onNodeDblClick }) => {
  const { width, height } = useContext(StaticContext);

  const [transform, setTransform] = useState<Transform>(identityTransform);

  const startPosRef = useRef<[number, number]>();
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (event: MouseEvent) => {
    if (event.ctrlKey || event.button) {
      // context menu
      return;
    }

    noEvent(event);

    startPosRef.current = transform.invertPoint([event.clientX, event.clientY]);
    setDragging(true);
  };

  const handleMouseMove = (event: MouseEvent) => {
    noEvent(event);

    if (!startPosRef.current || !dragging) return;

    setTransform(translate(transform, [event.clientX, event.clientY], startPosRef.current));
  };

  const handleMouseUp = (event: MouseEvent) => {
    noEvent(event);

    if (!dragging) return;

    setDragging(false);
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <g transform={transform.toString()}>
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
                  noEvent(evt);
                  onNodeHover(node);
                }}
                onDblClick={(evt) => {
                  noEvent(evt);
                  onNodeDblClick(node);
                }}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
};
