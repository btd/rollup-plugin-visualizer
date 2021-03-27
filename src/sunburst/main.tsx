import { HierarchyRectangularNode } from "d3-hierarchy";
import { FunctionalComponent } from "preact";
import { useContext, useMemo, useState } from "preact/hooks";

import { isModuleTree, ModuleRenderInfo, ModuleTree, ModuleTreeLeaf, ModuleUID, SizeKey } from "../../types/types";

import { SideBar } from "../sidebar";
import { Chart } from "./chart";

import { StaticContext } from "./index";

export type LinkInfo = ModuleRenderInfo & { uid: ModuleUID };
export type ModuleLinkInfo = Map<ModuleUID, LinkInfo[]>;

export const Main: FunctionalComponent = () => {
  const { availableSizeProperties, rawHierarchy, getModuleSize, layout } = useContext(StaticContext);

  const [sizeProperty, setSizeProperty] = useState<SizeKey>(availableSizeProperties[0]);

  const [selectedNode, setSelectedNode] = useState<HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf> | undefined>(
    undefined
  );

  const getNodeSizeMultiplier = useMemo(() => {
    if (selectedNode === undefined) {
      return (): number => 1;
    } else if (isModuleTree(selectedNode.data)) {
      const descendants = new Set(selectedNode.descendants().map((d) => d.data));
      return (node: ModuleTree | ModuleTreeLeaf): number => {
        if (descendants.has(node)) {
          return 3;
        }
        return 1;
      };
    } else {
      return (node: ModuleTree | ModuleTreeLeaf): number => {
        if (node === selectedNode.data) {
          return 3;
        }
        return 1;
      };
    }
  }, [selectedNode]);

  // root here always be the same as rawHierarchy even after layouting
  const root = useMemo(() => {
    const rootWithSizesAndSorted = rawHierarchy
      .sum((node) => getModuleSize(node, sizeProperty) * getNodeSizeMultiplier(node))
      .sort((a, b) => getModuleSize(a.data, sizeProperty) - getModuleSize(b.data, sizeProperty));

    return layout(rootWithSizesAndSorted);
  }, [getModuleSize, getNodeSizeMultiplier, layout, rawHierarchy, sizeProperty]);

  return (
    <>
      <SideBar
        sizeProperty={sizeProperty}
        availableSizeProperties={availableSizeProperties}
        setSizeProperty={setSizeProperty}
      />
      <Chart root={root} sizeProperty={sizeProperty} selectedNode={selectedNode} setSelectedNode={setSelectedNode} />
    </>
  );
};
