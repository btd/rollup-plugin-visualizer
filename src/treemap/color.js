import { scaleSequential, scaleLinear } from "d3-scale";
import { hsl } from "d3-color";

import { COLOR_BASE } from "../color";

// https://www.w3.org/TR/WCAG20/#relativeluminancedef
const rc = 0.2126;
const gc = 0.7152;
const bc = 0.0722;
// low-gamma adjust coefficient
const lowc = 1 / 12.92;

function adjustGamma(_) {
  return Math.pow((_ + 0.055) / 1.055, 2.4);
}

function relativeLuminance(o) {
  const rsrgb = o.r / 255;
  const gsrgb = o.g / 255;
  const bsrgb = o.b / 255;

  const r = rsrgb <= 0.03928 ? rsrgb * lowc : adjustGamma(rsrgb);
  const g = gsrgb <= 0.03928 ? gsrgb * lowc : adjustGamma(gsrgb);
  const b = bsrgb <= 0.03928 ? bsrgb * lowc : adjustGamma(bsrgb);

  return r * rc + g * gc + b * bc;
}

const createRainbowColor = (root) => {
  const colorParentMap = new Map();
  colorParentMap.set(root, COLOR_BASE);

  if (root.children != null) {
    const colorScale = scaleSequential([0, root.children.length - 1], (n) =>
      hsl(360 * n, 0.6, 0.85)
    );
    root.children.forEach((c, id) => {
      colorParentMap.set(c, colorScale(id));
    });
  }

  const colorMap = new Map();

  const lightScale = scaleLinear().domain([0, root.height]).range([0.9, 0.3]);

  const getBackgroundColor = (node) => {
    const parents = node.ancestors();
    const colorStr =
      parents.length === 1
        ? colorParentMap.get(parents[0])
        : colorParentMap.get(parents[parents.length - 2]);

    const hslColor = hsl(colorStr);
    hslColor.l = lightScale(node.depth);

    return hslColor;
  };

  return (node) => {
    if (!colorMap.has(node)) {
      const backgroundColor = getBackgroundColor(node);
      const l = relativeLuminance(backgroundColor.rgb());
      const fontColor = l > 0.179 ? "#000" : "#fff";
      colorMap.set(node, { backgroundColor, fontColor });
    }

    return colorMap.get(node);
  };
};

export default createRainbowColor;
