import pm from "picomatch";

export type Filter = {
  bundle: string | null | undefined;
  file: string | null | undefined;
};

function isArray(arg: unknown): arg is any[] | readonly any[] {
  return Array.isArray(arg);
}

function ensureArray<T>(thing: readonly T[] | T | undefined | null): readonly T[] {
  if (isArray(thing)) return thing;
  if (thing == null) return [];
  return [thing];
}

type Testable = {
  test: (what: string) => boolean;
};

const globToTest = (glob: string): Testable => {
  const pattern = glob;
  const fn = pm(pattern, { dot: true });
  return {
    test: (what: string) => {
      const result = fn(what);

      return result;
    },
  };
};

const testFalse: Testable = {
  test: () => false,
};

const testTrue: Testable = {
  test: () => true,
};

const getMatcher = (filter: Filter) => {
  const bundleTest =
    "bundle" in filter && filter.bundle != null ? globToTest(filter.bundle) : testTrue;
  const fileTest = "file" in filter && filter.file != null ? globToTest(filter.file) : testTrue;

  return { bundleTest, fileTest };
};

export const createFilter = (
  include: Filter | Filter[] | undefined,
  exclude: Filter | Filter[] | undefined
) => {
  const includeMatchers = ensureArray(include).map(getMatcher);
  const excludeMatchers = ensureArray(exclude).map(getMatcher);

  return (bundleId: string, id: string) => {
    for (let i = 0; i < excludeMatchers.length; ++i) {
      const { bundleTest, fileTest } = excludeMatchers[i];
      if (bundleTest.test(bundleId) && fileTest.test(id)) return false;
    }

    for (let i = 0; i < includeMatchers.length; ++i) {
      const { bundleTest, fileTest } = includeMatchers[i];
      if (bundleTest.test(bundleId) && fileTest.test(id)) return true;
    }

    return !includeMatchers.length;
  };
};
