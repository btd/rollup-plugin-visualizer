import { scaleSequential, scaleLinear } from "d3-scale";
import { interpolateSpectral as colorRainbow } from "d3-scale-chromatic";
import { hsl } from "d3-color";

const COLOR_DEFAULT_FILE = "#db7100";
const COLOR_DEFAULT_OWN_SOURCE = "#487ea4";
const COLOR_DEFAULT_VENDOR_SOURCE = "#599e59";

const colorDefault = node => {
  if (node.children && node.children.length) {
    const parents = node.ancestors();
    const hasNodeModules = parents.some(({ data: { name } }) => name === "node_modules");
    return hasNodeModules ? COLOR_DEFAULT_VENDOR_SOURCE : COLOR_DEFAULT_OWN_SOURCE;
  } else {
    return COLOR_DEFAULT_FILE;
  }
};

const COLOR_RAINBOW_BASE = "#cecece";

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

export const createRainbowColor = root => {
  const colorScale = scaleSequential([0, root.children.length - 1], colorRainbow);

  const colorParentMap = new Map(
    root.children.map((c, id) => {
      return [c.data.name, colorScale(id)];
    })
  );
  colorParentMap.set(root.data.name, COLOR_RAINBOW_BASE);

  const colorMap = new Map();

  const lightScale = scaleLinear()
    .domain([0, root.height])
    .range([0.8, 0.1]);

  const getBackgroundColor = node => {
    const parents = node.ancestors();
    const colorStr =
      parents.length === 1
        ? colorParentMap.get(parents[0].data.name)
        : colorParentMap.get(parents[parents.length - 2].data.name);

    const hslColor = hsl(colorStr);
    hslColor.l = lightScale(node.depth);

    return hslColor;
  };

  return node => {
    if (!colorMap.has(node)) {
      const backgroundColor = getBackgroundColor(node);
      const l = relativeLuminance(backgroundColor.rgb());
      const fontColor = l > 0.179 ? "#000" : "#fff";
      colorMap.set(node, { backgroundColor, fontColor });
    }

    return colorMap.get(node);
  };
};

export default colorDefault;
