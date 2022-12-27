import { FunctionalComponent } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { format as formatBytes } from "bytes";

import { HierarchyRectangularNode } from "d3-hierarchy";

import { LABELS } from "../sizes";
import { ModuleTree, ModuleTreeLeaf, SizeKey } from "../../shared/types";
import { StaticContext } from ".";

export interface TooltipProps {
  node: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  root: HierarchyRectangularNode<ModuleTree | ModuleTreeLeaf>;
  sizeProperty: SizeKey;
}

export const Tooltip: FunctionalComponent<TooltipProps> = ({ node, root, sizeProperty }) => {
  const { availableSizeProperties, getModuleSize } = useContext(StaticContext);

  const content = useMemo(() => {
    if (!node) return null;

    const mainSize = getModuleSize(node.data, sizeProperty);

    const percentageNum = (100 * mainSize) / getModuleSize(root.data, sizeProperty);
    const percentage = percentageNum.toFixed(2);
    const percentageString = percentage + "%";

    return (
      <>
        <div className="details-name">{node.data.name}</div>
        <div className="details-percentage">{percentageString}</div>
        {availableSizeProperties.map((sizeProp) => {
          if (sizeProp === sizeProperty) {
            return (
              <div className="details-size" key={sizeProp}>
                <b>
                  {LABELS[sizeProp]}: {formatBytes(getModuleSize(node.data, sizeProp))}
                </b>
              </div>
            );
          } else {
            return (
              <div className="details-size" key={sizeProp}>
                {LABELS[sizeProp]}: {formatBytes(getModuleSize(node.data, sizeProp))}
              </div>
            );
          }
        })}
      </>
    );
  }, [availableSizeProperties, getModuleSize, node, root.data, sizeProperty]);

  return <div className="details">{content}</div>;
};
