import { FunctionalComponent } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";
import { scaleSqrt } from "d3-scale";
import { max } from "d3-array";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

import { ModuleUID, SizeKey } from "../../types/types";

import { SideBar } from "../sidebar";
import { useFilter } from "../use-filter";
import { Chart } from "./chart";

import { getModuleColor } from "./color";
import { NetworkNode, StaticContext } from "./index";

export const Main: FunctionalComponent = () => {
  const { availableSizeProperties, nodes, data, width, height, groups } = useContext(StaticContext);

  const [viewportX, setViewportX] = useState(0);
  const [viewportY, setViewportY] = useState(0);

  const [sizeProperty, setSizeProperty] = useState<SizeKey>(availableSizeProperties[0]);

  const { getModuleFilterMultiplier, setExcludeFilter, setIncludeFilter } = useFilter();

  const sizeScale = useMemo(() => {
    const maxLines = max(Object.values(nodes), (d) => d[sizeProperty]) as number;
    const size = scaleSqrt().domain([1, maxLines]).range([5, 30]);
    return size;
  }, [nodes, sizeProperty]);

  const processedNodes = useMemo(() => {
    const newNodes: NetworkNode[] = [];

    for (const node of Object.values(nodes)) {
      if (getModuleFilterMultiplier(node) !== 1) {
        continue;
      }

      newNodes.push({
        ...node,
        radius: sizeScale(node[sizeProperty]),
        color: getModuleColor(node),
      });
    }
    return newNodes;
  }, [getModuleFilterMultiplier, nodes, sizeProperty, sizeScale]);

  const links = useMemo(() => {
    const nodesCache: Record<ModuleUID, NetworkNode> = Object.fromEntries(processedNodes.map((d) => [d.uid, d]));

    return Object.entries(data.nodeMetas)
      .flatMap(([sourceUid, { imported }]) => {
        return imported.map(({ uid: targetUid }) => {
          return {
            source: nodesCache[sourceUid],
            target: nodesCache[targetUid],
            value: 1,
          };
        });
      })
      .filter(({ source, target }) => {
        return source && target;
      });
  }, [data.nodeMetas, processedNodes]);

  const [animatedNodes, setAnimatedNodes] = useState<NetworkNode[]>([]);

  useEffect(() => {
    const simulation = forceSimulation<NetworkNode>()
      .force(
        "collision",
        forceCollide<NetworkNode>().radius((node) => node.radius)
      )
      .force("charge", forceManyBody().strength(-30))
      .force(
        "link",
        forceLink(links)
          .strength((link) => {
            if (groups[link.source.uid] === groups[link.target.uid]) {
              return 1;
            } else {
              return 0.1;
            }
          })
          .iterations(2)
      )
      .force("x", forceX(width / 2))
      .force("y", forceY(height / 2));
    //.tick(500);

    simulation.on("tick", () => {
      setAnimatedNodes([...simulation.nodes()]);
    });
    simulation.nodes([...processedNodes]);
    simulation.restart();

    return () => simulation.stop();
  }, [groups, height, links, processedNodes, width]);

  return (
    <>
      <SideBar
        sizeProperty={sizeProperty}
        availableSizeProperties={availableSizeProperties}
        setSizeProperty={setSizeProperty}
        onExcludeChange={setExcludeFilter}
        onIncludeChange={setIncludeFilter}
      />
      <Chart nodes={animatedNodes} viewport={[viewportX, viewportY]} links={links} sizeProperty={sizeProperty} />
    </>
  );
};
