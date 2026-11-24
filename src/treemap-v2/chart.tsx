import { displayModuleId } from "../../shared/display-module-id.js";
import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { hierarchy, treemap, treemapResquarify } from "d3-hierarchy";
import createRainbowColor from "./color";
import { PADDING, TOP_PADDING } from "../treemap/const";
import type { SizeKey } from "../../shared/types";
import { type InspectorData, type OutputNode, type Target, outputTarget } from "./data";
import { formatSize } from "./format";
import { TreeMapContext } from "./context";
import { TreeMap } from "./treemap";

interface Props {
  model: InspectorData;
  scope: OutputNode;
  metric: SizeKey;
  visibleParts: Set<string>;
  selected?: Target;
  inspect: (target: Target) => void;
}

export function Chart({ model, scope, metric, visibleParts, selected, inspect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<OutputNode>();
  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setBounds((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    });
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);

  const getModuleColor = useMemo(() => {
    // Keep the original report palette and depth shading while focusing a subtree.
    const root = hierarchy(model.root, (node) => node.children);
    const color = createRainbowColor(root);
    const colors = new Map(root.descendants().map((node) => [node.data.key, color(node)]));
    return (node: { data: OutputNode }) => colors.get(node.data.key)!;
  }, [model]);
  // Resquarify retains its rows across metric and filter changes, as in treemap.
  const root = useMemo(() => hierarchy(scope, (node) => node.children), [scope, bounds]);
  const layout = useMemo(() => {
    root
      .sum((node) =>
        node.partUid !== undefined && visibleParts.has(node.partUid)
          ? node.sizes[metric] || (node === scope ? 1 : 0)
          : 0,
      )
      .sort((a, b) => a.data.sizes[metric] - b.data.sizes[metric]);
    return treemap<OutputNode>()
      .size([Math.max(0, bounds.width), Math.max(0, bounds.height)])
      .tile(treemapResquarify)
      .paddingOuter(PADDING)
      .paddingTop(TOP_PADDING)
      .paddingInner(PADDING)
      .round(true)(root);
  }, [root, scope, metric, visibleParts, bounds]);
  const selectedNode = selected && model.node(selected);
  const selectedMeta = selected && model.metaUid(selected);

  return (
    <>
      <div className="tmv2-plot" ref={container} onMouseLeave={() => setHovered(undefined)}>
        {layout.value === 0 && (
          <p className="tmv2-chart-empty">
            No positive-size output matches this view and metric. Adjust the chart filters, metric,
            or use Overview. Details remain available.
          </p>
        )}
        <TreeMapContext.Provider value={{ ...bounds, getModuleColor }}>
          <TreeMap
            root={layout}
            isSelected={(node) =>
              selectedNode === node ||
              (selectedNode === undefined &&
                selectedMeta !== undefined &&
                node.metaUid === selectedMeta)
            }
            moduleId={(node) =>
              node.metaUid === undefined ? undefined : model.data.nodeMetas[node.metaUid].id
            }
            onNodeClick={(node) => inspect(outputTarget(node.data.key))}
            onNodeHover={(node) => setHovered(node.data)}
          />
        </TreeMapContext.Provider>
      </div>
      <div className="tmv2-hover" aria-hidden="true">
        <span>
          {hovered
            ? displayModuleId(model.path(outputTarget(hovered.key)))
            : "Click to inspect · Double-click a group to zoom"}
        </span>
        <span>{hovered && formatSize(hovered.sizes[metric])}</span>
      </div>
    </>
  );
}
