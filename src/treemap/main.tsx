import { useContext, useMemo, useState } from "preact/hooks";
import { HierarchyRectangularNode } from "d3-hierarchy";

import { FunctionalComponent } from "preact";
import { SideBar } from "../sidebar";
import { isModuleTree, ModuleTree, ModuleTreeLeaf, SizeKey } from "../../types/types";
import { useFilter } from "../use-filter";
import { Chart } from "./chart";

import { StaticContext } from "./index";

export const Main: FunctionalComponent = () => {
  const { availableSizeProperties, rawHierarchy, getModuleSize, layout, data } =
    useContext(StaticContext);

  const [sizeProperty, setSizeProperty] = useState<SizeKey>(availableSizeProperties[0]);

  const [selectedNode, setSelectedNode] = useState<
    HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined
  >(undefined);

  const { getModuleFilterMultiplier, setExcludeFilter, setIncludeFilter } = useFilter();

  console.time("getNodeSizeMultiplier");
  const getNodeSizeMultiplier = useMemo(() => {
    const rootSize = getModuleSize(rawHierarchy.data, sizeProperty);
    const selectedSize = selectedNode ? getModuleSize(selectedNode.data, sizeProperty) : 1;
    const multiplier = rootSize * 0.2 > selectedSize ? (rootSize * 0.2) / selectedSize : 3;
    if (selectedNode === undefined) {
      return (): number => 1;
    } else if (isModuleTree(selectedNode.data)) {
      const leaves = new Set(selectedNode.leaves().map((d) => d.data));
      return (node: ModuleTree | ModuleTreeLeaf): number => {
        if (leaves.has(node)) {
          return multiplier;
        }
        return 1;
      };
    } else {
      return (node: ModuleTree | ModuleTreeLeaf): number => {
        if (node === selectedNode.data) {
          return multiplier;
        }
        return 1;
      };
    }
  }, [getModuleSize, rawHierarchy.data, selectedNode, sizeProperty]);
  console.timeEnd("getNodeSizeMultiplier");

  console.time("root hierarchy compute");
  // root here always be the same as rawHierarchy even after layouting
  const root = useMemo(() => {
    const rootWithSizesAndSorted = rawHierarchy
      .sum((node) => {
        if (isModuleTree(node)) return 0;
        const ownSize = getModuleSize(node, sizeProperty);
        const zoomMultiplier = getNodeSizeMultiplier(node);
        const filterMultiplier = getModuleFilterMultiplier(
          data.nodeMetas[data.nodeParts[node.uid].mainUid]
        );

        return ownSize * zoomMultiplier * filterMultiplier;
      })
      .sort((a, b) => getModuleSize(a.data, sizeProperty) - getModuleSize(b.data, sizeProperty));

    return layout(rootWithSizesAndSorted);
  }, [
    data,
    getModuleFilterMultiplier,
    getModuleSize,
    getNodeSizeMultiplier,
    layout,
    rawHierarchy,
    sizeProperty,
  ]);

  console.timeEnd("root hierarchy compute");

  return (
    <>
      <SideBar
        sizeProperty={sizeProperty}
        availableSizeProperties={availableSizeProperties}
        setSizeProperty={setSizeProperty}
        onExcludeChange={setExcludeFilter}
        onIncludeChange={setIncludeFilter}
      />
      <Chart
        root={root}
        sizeProperty={sizeProperty}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
      />
    </>
  );
};
