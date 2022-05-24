import { FunctionalComponent } from "preact";
import { useContext, useEffect, useMemo, useState } from "preact/hooks";
import { scaleSqrt } from "d3-scale";
import { max } from "d3-array";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

import { ModuleUID } from "../../types/types";

import { Chart } from "./chart";

import { getModuleColor } from "./color";
import { NetworkNode, StaticContext } from "./index";

export const Main: FunctionalComponent = () => {
  const { nodes, data, width, height, groups, nodeGroups } = useContext(StaticContext);

  const groupsTotal = Object.entries(groups).length;

  const sizeScale = useMemo(() => {
    const maxLines = max(Object.values(nodes), (d) => d.renderedLength) as number;
    const size = scaleSqrt().domain([1, maxLines]).range([5, 30]);
    return size;
  }, [nodes]);

  const [excludedNodes, setExcludedNodes] = useState<ModuleUID[]>([]);

  const processedNodes = useMemo(() => {
    const newNodes: NetworkNode[] = [];

    for (const node of Object.values(nodes)) {
      //if (node.renderedLength === 0) continue;
      if (excludedNodes.includes(node.uid)) continue;

      const groupId = groups[nodeGroups[node.uid]];

      newNodes.push({
        ...node,
        x: groupId == 0 ? width / 2 : Math.cos((groupId / groupsTotal) * 2 * Math.PI) * 200 + width / 2 + Math.random(),
        y:
          groupId == 0
            ? height / 2
            : Math.sin((groupId / groupsTotal) * 2 * Math.PI) * 200 + height / 2 + Math.random(),
        radius: sizeScale(node.renderedLength),
        color: getModuleColor(node),
      });
    }
    return newNodes;
  }, [excludedNodes, groups, groupsTotal, height, nodeGroups, nodes, sizeScale, width]);

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
            if (nodeGroups[link.source.uid] === nodeGroups[link.target.uid]) {
              return 1;
            } else {
              return 0.1;
            }
          })
          .iterations(2)
      )
      .force("x", forceX(width / 2))
      .force("y", forceY(height / 2));

    simulation.on("tick", () => {
      setAnimatedNodes([...simulation.nodes()]);
    });
    simulation.nodes([...processedNodes]);
    simulation.alphaMin(0.03).restart();

    return () => simulation.stop();
  }, [nodeGroups, height, links, processedNodes, width]);

  return (
    <Chart
      nodes={animatedNodes}
      onNodeExclude={(node) => setExcludedNodes([...excludedNodes, node.uid])}
      links={links}
    />
  );
};
