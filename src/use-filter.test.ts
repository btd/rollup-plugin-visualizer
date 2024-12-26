import { describe, it, expect } from "vitest";

import { prepareFilter } from "./use-filter";

describe("Parse filter", () => {
  it.each([
    ["", []],
    ["**/node_modules/**", [{ file: "**/node_modules/**", bundle: null }]],
    [":**/node_modules/**", [{ file: "**/node_modules/**", bundle: null }]],
    [":", [{ file: null, bundle: null }]],
    ["bundle-*.js:", [{ file: null, bundle: "bundle-*.js" }]],
    [
      "bundle.js:**/node_modules/d3-*/**",
      [{ file: "**/node_modules/d3-*/**", bundle: "bundle.js" }],
    ],
    ["bundle.js:id with :", [{ file: "id with :", bundle: "bundle.js" }]],
  ])("parse input %j to %j", (input, result) => {
    const actual = prepareFilter(input);

    expect(actual).toEqual(result);
  });
});
