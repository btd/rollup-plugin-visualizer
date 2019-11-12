export const findEntryNodes = nodes => {
  const entries = [];
  for (const [uid, { isEntry }] of Object.entries(nodes)) {
    if (isEntry) {
      entries.push(uid);
    }
  }
  return entries;
};

export const findPath = (startNode, links, endNode) => {
  const queue = [[startNode]];
  const visitedNodes = new Set();

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const lastNode = currentPath[currentPath.length - 1];
    if (lastNode === endNode) {
      return currentPath;
    }

    visitedNodes.add(lastNode);

    const availableNodes = links.get(lastNode) || [];
    const notVisitedAvailableNodes = availableNodes.filter(
      n => !visitedNodes.has(n)
    );

    for (const notVisitedAvailableNode of notVisitedAvailableNodes) {
      const newPath = [...currentPath, notVisitedAvailableNode];
      queue.push(newPath);
    }
  }
};
