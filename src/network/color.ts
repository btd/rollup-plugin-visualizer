import { scaleSequential } from "d3-scale";
import { hsl } from "d3-color";

import { CssColor } from "../color";
import { NodeInfo } from ".";

export type NodeColorGetter = (node: NodeInfo) => CssColor;

const createRainbowColor = (groups: Record<string, unknown>): NodeColorGetter => {
  const groupColor = new Map<string, CssColor>();

  const groupNames = Object.keys(groups);

  const colorScale = scaleSequential([0, groupNames.length], (n) => hsl(360 * n, 0.3, 0.5));
  groupNames.forEach((c, id) => {
    groupColor.set(c, colorScale(id).toString());
  });

  const getBackgroundColor = (node: NodeInfo) => {
    const colorStr = groupColor.get(node.group);

    const hslColor = hsl(colorStr as string);
    hslColor.l = node.renderedLength === 0 ? 0.9 : hslColor.l;

    return hslColor;
  };

  return (node: NodeInfo): CssColor => {
    const backgroundColor = getBackgroundColor(node);

    return backgroundColor.toString();
  };
};

export default createRainbowColor;
