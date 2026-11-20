import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { createFilter } from "../shared/create-filter";
import { prepareFilter, throttleFilter } from "./use-filter";

describe("Live filter updates", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(["**/入口😀.js", ""])("applies the latest rapid edit %j", (latest) => {
    const applied: string[] = [];
    const update = throttleFilter((value) => applied.push(value), 200);

    update("**/three/**");
    vi.advanceTimersByTime(50);
    update("**/src/**");
    vi.advanceTimersByTime(50);
    update(latest);
    vi.advanceTimersByTime(99);
    expect(applied).toEqual(["**/three/**"]);

    vi.advanceTimersByTime(1);
    expect(applied).toEqual(["**/three/**", latest]);
    vi.advanceTimersByTime(200);
    expect(applied).toEqual(["**/three/**", latest]);
  });

  it("keeps sustained edits throttled after the first trailing update", () => {
    const applied: string[] = [];
    const update = throttleFilter((value) => applied.push(value), 200);

    update("first");
    vi.advanceTimersByTime(100);
    update("second");
    vi.advanceTimersByTime(100);
    expect(applied).toEqual(["first", "second"]);
    update("third");
    vi.advanceTimersByTime(100);
    update("fourth");
    expect(applied).toEqual(["first", "second"]);
    vi.advanceTimersByTime(100);
    expect(applied).toEqual(["first", "second", "fourth"]);

    vi.advanceTimersByTime(200);
    update("after idle");
    expect(applied).toEqual(["first", "second", "fourth", "after idle"]);
  });

  it("applies include and exclude edits independently to module paths", () => {
    let include = "";
    let exclude = "";
    const updateInclude = throttleFilter((value) => (include = value), 200);
    const updateExclude = throttleFilter((value) => (exclude = value), 200);

    updateInclude("**/three/**");
    updateExclude("**/other.js");
    updateInclude("**/src/**");
    updateExclude("**/入口😀.js");
    vi.advanceTimersByTime(200);

    const isIncluded = createFilter(prepareFilter(include), prepareFilter(exclude));
    expect(isIncluded("bundle.js", "/src/入口😀.js")).toBe(false);
    expect(isIncluded("bundle.js", "/src/café.js")).toBe(true);
    expect(isIncluded("bundle.js", "/node_modules/three/index.js")).toBe(false);
  });

  it("cancels a pending update when its consumer is removed", () => {
    const applied: string[] = [];
    const update = throttleFilter((value) => applied.push(value), 200);

    update("**/three/**");
    update("");
    update.cancel();
    vi.advanceTimersByTime(200);

    expect(applied).toEqual(["**/three/**"]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

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
