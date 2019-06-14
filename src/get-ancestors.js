export default function getAncestors(node) {
  const parents = [];
  while (node != null) {
    parents.push(node);
    node = node.parent;
  }
  return parents;
}
