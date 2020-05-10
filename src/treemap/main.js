import { useState } from "preact/hooks";
import { html } from "htm/preact";
import {
  hierarchy as d3hierarchy,
  treemap as d3treemap,
  treemapResquarify,
} from "d3-hierarchy";

import SideBar from "../sidebar.js";
import Chart from "./chart.js";

import uid from "../uid";
import createRainbowColor from "./color";
import { getAvailableSizeOptions } from "../sizes";

const Main = ({
  width,
  height,
  data: { tree, nodes, links, options = {} },
}) => {
  const availableSizeProperties = getAvailableSizeOptions(options);

  const [sizeProperty, setSizeProperty] = useState(availableSizeProperties[0]);

  const layout = d3treemap()
    .size([width, height])
    .paddingOuter(8)
    .paddingTop(20)
    .paddingInner(5)
    .round(true)
    .tile(treemapResquarify);

  const root = d3hierarchy(tree)
    .eachAfter((node) => {
      const value = {};
      for (const prop of availableSizeProperties) {
        value[prop] = 0;
      }

      // use node.data.children because if it is empty d3 will skip this node
      // and it will look like it is actually a leaf - which technically it is but not exactly
      // it is just a chunk without deps - usually just with imports
      if (node.children == null && node.data.children != null) {
        // this should be root withiout children
        for (const prop of availableSizeProperties) {
          value[prop] += node.data[prop] || 0;
        }
      } else if (node.data.children != null) {
        const children = node.children;
        let i = node.data.children.length;
        while (--i >= 0) {
          for (const prop of availableSizeProperties) {
            value[prop] += children[i].originalValue[prop] || 0;
          }
        }
      } else {
        for (const prop of availableSizeProperties) {
          value[prop] = nodes[node.data.uid][prop] || 0;
        }
      }

      node.clipUid = uid("clip");
      node.nodeUid = uid("node");

      node.originalValue = value;
      node.value = value[sizeProperty];
    })
    .sort(
      (a, b) => b.originalValue[sizeProperty] - a.originalValue[sizeProperty]
    );

  const color = createRainbowColor(root);

  const importedByCache = new Map();
  const importedCache = new Map();

  for (const { source, target } of links || []) {
    if (!importedByCache.has(target)) {
      importedByCache.set(target, []);
    }
    if (!importedCache.has(source)) {
      importedCache.set(source, []);
    }

    importedByCache.get(target).push({ uid: source, ...nodes[source] });
    importedCache.get(source).push({ uid: target, ...nodes[target] });
  }

  return html`
    <${SideBar}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
      setSizeProperty=${setSizeProperty}
    />
    <${Chart}
      layout=${layout}
      root=${root}
      color=${color}
      width=${width}
      height=${height}
      sizeProperty=${sizeProperty}
      availableSizeProperties=${availableSizeProperties}
      importedByCache=${importedByCache}
      importedCache=${importedCache}
    />
  `;
};

export default Main;
