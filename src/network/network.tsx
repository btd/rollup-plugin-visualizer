import { FunctionalComponent } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { fitTransform, identityTransform, Transform } from "./transform";
import { svgPoint } from "./point";
import { NodeColorGetter } from "./color";
import { StaticContext } from ".";
import type { NetworkLink, NetworkNode } from "./types";

export interface NetworkProps {
  onNodeHover: (node?: NetworkNode) => void;
  onNodeDblClick: (node: NetworkNode) => void;
  nodes: NetworkNode[];
  links: NetworkLink[];
  getColor: NodeColorGetter;
  onNodeClick: (node: NetworkNode) => void;
  onCanvasClick: () => void;
  onNodeDragStart: () => void;
  onNodeDrag: (node: NetworkNode, point: [number, number]) => void;
  onNodeDragEnd: () => void;
  onResetLayout: () => void;
  onRestoreNodes: () => void;
  excludedCount: number;
  selectedNode?: string;
  layoutVersion: number;
}

interface Gesture {
  pointerId: number;
  capture: SVGElement;
  client: [number, number];
  point: [number, number];
  transform: Transform;
  node?: NetworkNode;
  offset: [number, number];
  moved: boolean;
}

export const Network: FunctionalComponent<NetworkProps> = ({
  links,
  nodes,
  onNodeHover,
  onNodeDblClick,
  getColor,
  onCanvasClick,
  onNodeClick,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragEnd,
  onResetLayout,
  onRestoreNodes,
  excludedCount,
  selectedNode,
  layoutVersion,
}) => {
  const { width, height } = useContext(StaticContext);
  const svgRef = useRef<SVGSVGElement>(null);
  const controlsRef = useRef<HTMLDetailsElement>(null);
  const [transform, setTransform] = useState(identityTransform);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const nodesRef = useRef(nodes);
  const graphChanged = nodesRef.current !== nodes;
  nodesRef.current = nodes;
  const gesture = useRef<Gesture | undefined>(undefined);
  const suppressClick = useRef(false);
  const autoFit = useRef(true);
  if (graphChanged) autoFit.current = false;
  const [dragging, setDragging] = useState(false);

  const updateTransform = (next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  };
  const fit = () => updateTransform(fitTransform(nodesRef.current, width, height));

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const controls = controlsRef.current;
      if (controls && !controls.contains(event.target as Node)) controls.open = false;
    };
    document.addEventListener("pointerdown", closeOutside, true);
    return () => document.removeEventListener("pointerdown", closeOutside, true);
  }, []);

  // Fit on first display and once after the initial layout settles. Any user
  // interaction takes ownership of the camera, including during that layout.
  useEffect(() => {
    if (!autoFit.current) return;
    fit();
    if (layoutVersion > 0) autoFit.current = false;
  }, [layoutVersion, width, height]);

  useEffect(() => {
    const svg = svgRef.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (gesture.current) return;
      autoFit.current = false;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      updateTransform(
        transformRef.current.zoomAt(svgPoint(svg, event), Math.exp(-event.deltaY * unit * 0.002)),
      );
      onNodeHover(undefined);
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [height, onNodeHover]);

  const begin = (event: PointerEvent, node?: NetworkNode) => {
    if (event.button !== 0 || event.ctrlKey || gesture.current) return;
    event.preventDefault();
    event.stopPropagation();
    const svg = svgRef.current!;
    const point = svgPoint(svg, event);
    const current = transformRef.current;
    const graphPoint = current.invertPoint(point);
    const capture = node ? (event.currentTarget as SVGElement) : svg;
    gesture.current = {
      pointerId: event.pointerId,
      capture,
      client: [event.clientX, event.clientY],
      point,
      transform: current,
      node,
      offset: node ? [node.x! - graphPoint[0], node.y! - graphPoint[1]] : [0, 0],
      moved: false,
    };
    suppressClick.current = false;
    capture.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    // The drag threshold is measured in CSS pixels, independently of zoom.
    if (
      !active.moved &&
      Math.hypot(event.clientX - active.client[0], event.clientY - active.client[1]) < 3
    )
      return;
    event.preventDefault();
    if (!active.moved) {
      active.moved = true;
      autoFit.current = false;
      setDragging(true);
      onNodeHover(undefined);
      if (active.node) onNodeDragStart();
    }
    const point = svgPoint(svgRef.current!, event);
    if (active.node) {
      const [x, y] = active.transform.invertPoint(point);
      onNodeDrag(active.node, [x + active.offset[0], y + active.offset[1]]);
    } else {
      updateTransform(
        new Transform(
          active.transform.k,
          active.transform.x + point[0] - active.point[0],
          active.transform.y + point[1] - active.point[1],
        ),
      );
    }
  };

  const finish = (event: PointerEvent) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    gesture.current = undefined;
    suppressClick.current = active.moved;
    setDragging(false);
    if (active.node && active.moved) onNodeDragEnd();
    if (active.capture.hasPointerCapture(event.pointerId))
      active.capture.releasePointerCapture(event.pointerId);
  };

  const zoom = (factor: number) => {
    autoFit.current = false;
    updateTransform(transformRef.current.zoomAt([0, 0], factor));
  };

  return (
    <>
      <svg
        ref={svgRef}
        className={`network ${dragging ? "network-dragging" : ""}`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        role="img"
        aria-label="Module dependency network"
        onPointerDown={(event) => begin(event)}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={finish}
        onClick={() => {
          if (!suppressClick.current) onCanvasClick();
        }}
      >
        <g transform={transform.toString()}>
          <g stroke="#fff" stroke-width="1">
            {links.map((link, index) => (
              <line
                key={`${link.source.uid}-${link.target.uid}-${index}`}
                stroke-opacity={
                  selectedNode ? (link.target.uid === selectedNode ? 0.85 : 0.06) : 0.22
                }
                x1={link.source.x}
                y1={link.source.y}
                x2={link.target.x}
                y2={link.target.y}
              />
            ))}
          </g>
          <g stroke="#fff" stroke-width="1.5">
            {nodes.map((node) => (
              <circle
                className="node"
                key={node.uid}
                data-uid={node.uid}
                aria-label={node.id}
                r={node.radius}
                fill={getColor(node)}
                cx={node.x}
                cy={node.y}
                stroke-width={node.uid === selectedNode ? 3 : 1.5}
                onPointerDown={(event) => begin(event, node)}
                onMouseOver={(event) => {
                  event.stopPropagation();
                  if (!gesture.current?.moved) onNodeHover(node);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!suppressClick.current) onNodeClick(node);
                }}
                onDblClick={(event) => {
                  event.stopPropagation();
                  if (!suppressClick.current) onNodeDblClick(node);
                }}
              />
            ))}
          </g>
        </g>
      </svg>
      <div className="network-controls" aria-label="Network navigation">
        <div className="network-buttons network-toolbar">
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1.3)}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.3)}>
            −
          </button>
          <button
            type="button"
            onClick={() => {
              autoFit.current = false;
              fit();
            }}
          >
            Fit graph
          </button>
          <details
            ref={controlsRef}
            className="network-menu"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }}
          >
            <summary>Controls{excludedCount > 0 ? ` (${excludedCount} hidden)` : ""}</summary>
            <div className="network-menu-content">
              <div className="network-actions">
                <button
                  type="button"
                  onClick={() => {
                    autoFit.current = false;
                    updateTransform(identityTransform);
                    controlsRef.current!.open = false;
                  }}
                >
                  Reset view
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResetLayout();
                    autoFit.current = true;
                    fit();
                    controlsRef.current!.open = false;
                  }}
                >
                  Reset layout
                </button>
                {excludedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreNodes();
                      controlsRef.current!.open = false;
                    }}
                  >
                    Restore hidden ({excludedCount})
                  </button>
                )}
              </div>
              <ul className="network-gestures" aria-label="Mouse actions">
                <li>Drag background to pan</li>
                <li>Scroll to zoom</li>
                <li>Drag node to pin it</li>
                <li>Click node to highlight its importers</li>
                <li>Click background to clear selection</li>
                <li>Double-click node to hide it</li>
              </ul>
            </div>
          </details>
        </div>
      </div>
      {nodes.length === 0 && (
        <div className="network-empty">No modules match the current filters.</div>
      )}
    </>
  );
};
