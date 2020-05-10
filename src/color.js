export const COLOR_DEFAULT_FILE = "#db7100";
export const COLOR_DEFAULT_OWN_SOURCE = "#487ea4";
export const COLOR_DEFAULT_VENDOR_SOURCE = "#599e59";

export const COLOR_BASE = "#cecece";

const colorDefault = (node) => {
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

export default colorDefault;
