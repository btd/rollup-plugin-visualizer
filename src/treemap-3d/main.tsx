import { useContext, useMemo, useState } from "preact/hooks";
import { HierarchyRectangularNode } from "d3-hierarchy";

import { FunctionalComponent } from "preact";
import { SideBar } from "../sidebar";
import { isModuleTree, ModuleTree, ModuleTreeLeaf, SizeKey } from "../../shared/types";
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

  const getNodeSizeMultiplier = useMemo(() => {
    const selectedMultiplier = 1;
    const nonSelectedMultiplier = 0;

    if (selectedNode === undefined) {
      return (): number => 1;
    } else if (isModuleTree(selectedNode.data)) {
      const leaves = new Set(selectedNode.leaves().map((d) => d.data));
      return (node: ModuleTree | ModuleTreeLeaf): number => {
        if (leaves.has(node)) {
          return selectedMultiplier;
        }
        return nonSelectedMultiplier;
      };
    } else {
      return (node: ModuleTree | ModuleTreeLeaf): number => {
        if (node === selectedNode.data) {
          return selectedMultiplier;
        }
        return nonSelectedMultiplier;
      };
    }
  }, [selectedNode]);

  const root = useMemo(() => {
    const rootWithSizesAndSorted = rawHierarchy
      .sum((node) => {
        if (isModuleTree(node)) return 0;

        const meta = data.nodeMetas[data.nodeParts[node.uid].metaUid];

        /* eslint-disable typescript/no-non-null-asserted-optional-chain typescript/no-extra-non-null-assertion */
        const bundleId = Object.entries(meta.moduleParts).find(([, uid]) => uid == node.uid)?.[0]!!;

        const ownSize = getModuleSize(node, sizeProperty);
        const zoomMultiplier = getNodeSizeMultiplier(node);
        const filterMultiplier = getModuleFilterMultiplier(bundleId, meta);

        return ownSize * zoomMultiplier * filterMultiplier;
      })
      // eslint-disable-next-line unicorn/no-array-sort
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
