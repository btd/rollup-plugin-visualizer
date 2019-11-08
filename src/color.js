import { scaleSequential, scaleLinear } from "d3-scale";
import { interpolateSpectral as colorRainbow } from "d3-scale-chromatic";
import { hsl } from "d3-color";

const COLOR_DEFAULT_FILE = "#db7100";
const COLOR_DEFAULT_OWN_SOURCE = "#487ea4";
const COLOR_DEFAULT_VENDOR_SOURCE = "#599e59";

const colorDefault = node => {
  if (node.children && node.children.length) {
    const parents = node.ancestors();
    const hasNodeModules = parents.some(
      ({ data: { name } }) => name === "node_modules"
    );
    return hasNodeModules
      ? COLOR_DEFAULT_VENDOR_SOURCE
      : COLOR_DEFAULT_OWN_SOURCE;
  } else {
    return COLOR_DEFAULT_FILE;
  }
};

const COLOR_RAINBOW_BASE = "#cecece";

export const createRainbowColor = root => {
  const colorScale = scaleSequential(
    [0, root.children.length - 1],
    colorRainbow
  );

  const colorMap = new Map(
    root.children.map((c, id) => {
      return [c.data.name, colorScale(id)];
    })
  );
  colorMap.set(root.data.name, COLOR_RAINBOW_BASE);

  const lightScale = scaleLinear()
    .domain([0, root.height])
    .range([0.8, 0.1]);

  const getColorByRootChild = node => {
    const parents = node.ancestors();
    const colorStr =
      parents.length === 1
        ? colorMap.get(parents[0].data.name)
        : colorMap.get(parents[parents.length - 2].data.name);

    const hslColor = hsl(colorStr);
    hslColor.l = lightScale(node.depth);

    return hslColor.toString();
  };

  return getColorByRootChild;
};

export default colorDefault;
