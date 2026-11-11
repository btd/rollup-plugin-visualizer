import { FunctionalComponent } from "preact";
import { useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Simulation } from "d3-force";

import { COLOR_BASE } from "../color";
import { useFilter } from "../use-filter";
import { SideBar } from "../sidebar";
import { Chart } from "./chart";
import createRainbowColor from "./color";
import { StaticContext } from "./index";
import { createChartData, matchesFilter } from "./data";
import { createLayout, createSimulation } from "./layout";
import type { NetworkNode, NodeInfo } from "./types";

export const Main: FunctionalComponent = () => {
  const { data } = useContext(StaticContext);
  const { nodes, groups } = useMemo(() => createChartData(data), [data]);
  const layout = useMemo(() => createLayout(nodes), [nodes]);
  const getModuleColor = useMemo(() => createRainbowColor(groups), [groups]);
  const simulation = useRef<Simulation<NetworkNode, undefined> | undefined>(undefined);
  const [, setFrame] = useState(0);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [excludedNodes, setExcludedNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>();
  const { getModuleFilterMultiplier, setExcludeFilter, setIncludeFilter } = useFilter();

  const processedNodes = useMemo(
    () =>
      layout.nodes.filter(
        (node) =>
          !excludedNodes.includes(node.uid) && matchesFilter(node, getModuleFilterMultiplier),
      ),
    [layout, excludedNodes, getModuleFilterMultiplier],
  );
  const links = useMemo(() => {
    const visible = new Set(processedNodes);
    return layout.links.filter(({ source, target }) => visible.has(source) && visible.has(target));
  }, [layout, processedNodes]);

  // Keep node objects and their positions across filtering and viewport changes.
  useEffect(() => {
    const current = createSimulation(processedNodes, links, layout.centers)
      .on("tick", () => setFrame((frame) => frame + 1))
      .on("end", () => setLayoutVersion((version) => version + 1));
    simulation.current = current;
    return () => {
      current.stop();
      simulation.current = undefined;
    };
  }, [layout, links, processedNodes]);

  const highlighted = useMemo(
    () =>
      new Set([
        selectedNode,
        ...(selectedNode ? data.nodeMetas[selectedNode].importedBy.map(({ uid }) => uid) : []),
      ]),
    [data, selectedNode],
  );
  const activeSelection = processedNodes.some((node) => node.uid === selectedNode)
    ? selectedNode
    : undefined;
  const getColor = (node: NodeInfo) =>
    activeSelection == null || highlighted.has(node.uid) ? getModuleColor(node) : COLOR_BASE;

  return (
    <>
      <SideBar
        sizeProperty="renderedLength"
        availableSizeProperties={["renderedLength"]}
        setSizeProperty={() => {}}
        onExcludeChange={setExcludeFilter}
        onIncludeChange={setIncludeFilter}
      />
      <Chart
        nodes={processedNodes}
        links={links}
        getColor={getColor}
        selectedNode={activeSelection}
        layoutVersion={layoutVersion}
        excludedCount={excludedNodes.length}
        onRestoreNodes={() => setExcludedNodes([])}
        onResetLayout={() => {
          layout.reset();
          setSelectedNode(undefined);
          simulation.current?.alpha(1).alphaTarget(0).restart();
          setFrame((frame) => frame + 1);
        }}
        onNodeExclude={(node) => {
          setExcludedNodes((excluded) => [...excluded, node.uid]);
          setSelectedNode(undefined);
        }}
        onNodeSelect={(uid) => setSelectedNode((selected) => (uid === selected ? undefined : uid))}
        onNodeDragStart={() => simulation.current?.alphaTarget(0.15).restart()}
        onNodeDrag={(node, [x, y]) => {
          node.fx = node.x = x;
          node.fy = node.y = y;
          setFrame((frame) => frame + 1);
        }}
        onNodeDragEnd={() => simulation.current?.alphaTarget(0)}
      />
    </>
  );
};
