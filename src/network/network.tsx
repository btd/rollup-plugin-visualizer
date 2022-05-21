/* eslint-disable react/no-unknown-property */
import { FunctionalComponent } from "preact";
import { useContext } from "preact/hooks";
import { NetworkLink, NetworkNode, StaticContext } from ".";

export interface NetworkProps {
  onNodeHover: (event: NetworkNode) => void;
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export const Network: FunctionalComponent<NetworkProps> = ({ links, nodes, onNodeHover }) => {
  const { width, height } = useContext(StaticContext);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`}>
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
