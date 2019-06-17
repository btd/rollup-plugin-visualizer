import getAncestors from "./get-ancestors";

export default function color(node) {
  if (node.children && node.children.length) {
    const parents = getAncestors(node);
    const hasNodeModules = !!parents.find(n => {
      return n.data.name === "node_modules";
    });
    return hasNodeModules ? "#599e59" : "#487ea4";
  } else {
    return "#db7100";
  }
}
