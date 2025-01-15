import { describe, it, expect } from "vitest";
import { createFilter as _createFilter, Filter } from "./create-filter";

describe("createFilter", () => {
  const createFilter = (include: Filter | Filter[] | undefined, exclude: Filter | Filter[] | undefined) => _createFilter(include, exclude, 'glob')
  it("should return true when input and output is empty", () => {
    const isIncluded = createFilter([], []);
    expect(isIncluded("bundle", "file")).toBe(true);
  });

  describe("Bundle", () => {
    it.each([
      [[{ bundle: "b1.js" }], "b1.js", "file", false],
      [[{ bundle: "b1.js" }], "b2.js", "file", true],
      [[{ bundle: "translation-*.js" }], "b2.js", "file", true],
      [[{ bundle: "translation-*.js" }], "translation-de.js", "file", false],
    ])("%# should exclude %j bundle %j file %j - %j", (exclude, bundle, file, result) => {
      const isIncluded = createFilter([], exclude);
      expect(isIncluded(bundle, file)).toBe(result);
    });

    it.each([
      [[{ bundle: "b1.js" }], "b1.js", "file", true],
      [[{ bundle: "b1.js" }], "b2.js", "file", false],
      [[{ bundle: "translation-*.js" }], "b2.js", "file", false],
      [[{ bundle: "translation-*.js" }], "translation-de.js", "file", true],
    ])("%# should include %j bundle %j file %j - %j", (include, bundle, file, result) => {
      const isIncluded = createFilter(include, []);
      expect(isIncluded(bundle, file)).toBe(result);
    });

    it.each([
      [
        [{ bundle: "translation-*.js" }],
        [{ bundle: "translation-de.js" }],
        "translation-de.js",
        "file",
        false,
      ],
      [
        [{ bundle: "translation-*.js" }],
        [{ bundle: "translation-de.js" }],
        "translation-en.js",
        "file",
        true,
      ],
    ])(
      "%# should exclude included %j %j bundle %j file %j - %j",
      (include, exclude, bundle, file, result) => {
        const isIncluded = createFilter(include, exclude);
        expect(isIncluded(bundle, file)).toBe(result);
      }
    );
  });

  describe("File", () => {
    it.each([
      [[{ file: "b1.js" }], "bundle", "b1.js", false],
      [[{ file: "b1.js" }], "bundle", "b2.js", true],
      [[{ file: "translation-*.js" }], "bundle", "b2.js", true],
      [[{ file: "translation-*.js" }], "bundle", "translation-de.js", false],
    ])("%# should exclude %j bundle %j file %j - %j", (exclude, bundle, file, result) => {
      const isIncluded = createFilter([], exclude);
      expect(isIncluded(bundle, file)).toBe(result);
    });

    it.each([
      [[{ file: "b1.js" }], "bundle", "b1.js", true],
      [[{ file: "b1.js" }], "bundle", "b2.js", false],
      [[{ file: "translation-*.js" }], "bundle", "b2.js", false],
      [[{ file: "translation-*.js" }], "bundle", "translation-de.js", true],
    ])("%# should include %j bundle %j file %j - %j", (include, bundle, file, result) => {
      const isIncluded = createFilter(include, []);
      expect(isIncluded(bundle, file)).toBe(result);
    });

    it.each([
      [
        [{ file: "translations/**" }],
        [{ file: "translations/de.js" }],
        "bundle",
        "translations/de.js",
        false,
      ],
      [
        [{ file: "translations/**" }],
        [{ file: "translations/de.js" }],
        "bundle",
        "translations/en.js",
        true,
      ],
    ])(
      "%# should exclude included %j %j bundle %j file %j - %j",
      (include, exclude, bundle, file, result) => {
        const isIncluded = createFilter(include, exclude,);
        expect(isIncluded(bundle, file)).toBe(result);
      }
    );
  });

  describe("File in Bundle", () => {
    it.each([
      [[{ bundle: "b1.js", file: "f1.js" }], "b1.js", "f1.js", false],
      [[{ bundle: "b1.js", file: "f1.js" }], "b2.js", "f1.js", true],
      [[{ bundle: "b1.js", file: "f1.js" }], "b1.js", "f2.js", true],
    ])("%# should exclude %j bundle %j file %j - %j", (exclude, bundle, file, result) => {
      const isIncluded = createFilter([], exclude);
      expect(isIncluded(bundle, file)).toBe(result);
    });

    it.each([
      [[{ bundle: "b1.js", file: "f1.js" }], "b1.js", "f1.js", true],
      [[{ bundle: "b1.js", file: "f1.js" }], "b2.js", "f1.js", false],
      [[{ bundle: "b1.js", file: "f1.js" }], "b1.js", "f2.js", false],
    ])("%# should include %j bundle %j file %j - %j", (include, bundle, file, result) => {
      const isIncluded = createFilter(include, []);
      expect(isIncluded(bundle, file)).toBe(result);
    });
  });
});
