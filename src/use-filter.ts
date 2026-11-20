import { useState, useMemo, useCallback, useLayoutEffect } from "preact/hooks";
import { createFilter } from "../shared/create-filter";

export type FilterSetter = (value: string) => void;

export const throttleFilter = (callback: FilterSetter, limit: number) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;

  const update = (val: string): void => {
    if (timer === undefined) {
      callback(val);
      timer = setTimeout(() => {
        timer = undefined;
        if (pending !== undefined) {
          const latest = pending;
          pending = undefined;
          update(latest);
        }
      }, limit);
    } else {
      pending = val;
    }
  };

  update.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  return update;
};

export type UseFilter = {
  includeFilter: string;
  excludeFilter: string;
  setIncludeFilter: FilterSetter;
  setExcludeFilter: FilterSetter;
  getModuleFilterMultiplier: (bundleId: string, data: { id: string }) => number;
};

export const prepareFilter = (filt: string) => {
  if (filt === "") return [];
  return (
    filt
      .split(",")
      // remove spaces before and after
      .map((entry) => entry.trim())
      // unquote "
      .map((entry) =>
        entry.startsWith('"') && entry.endsWith('"') ? entry.substring(1, entry.length - 1) : entry,
      )
      // unquote '
      .map((entry) =>
        entry.startsWith("'") && entry.endsWith("'") ? entry.substring(1, entry.length - 1) : entry,
      )
      // remove empty strings
      .filter((entry) => entry)
      // parse bundle:file
      .map((entry) => entry.split(":"))
      // normalize entry just in case
      .flatMap((entry) => {
        if (entry.length === 0) return [];
        let bundle = null;
        let file = null;
        if (entry.length === 1 && entry[0]) {
          file = entry[0];
          return [{ file, bundle }];
        }

        bundle = entry[0] || null;
        file = entry.slice(1).join(":") || null;

        return [{ bundle, file }];
      })
  );
};

export const useFilter = (): UseFilter => {
  const [includeFilter, setIncludeFilter] = useState<string>("");
  const [excludeFilter, setExcludeFilter] = useState<string>("");

  const setIncludeFilterThrottled = useMemo(() => throttleFilter(setIncludeFilter, 200), []);
  const setExcludeFilterThrottled = useMemo(() => throttleFilter(setExcludeFilter, 200), []);

  useLayoutEffect(
    () => () => {
      setIncludeFilterThrottled.cancel();
      setExcludeFilterThrottled.cancel();
    },
    [setIncludeFilterThrottled, setExcludeFilterThrottled],
  );

  const isIncluded = useMemo(
    () => createFilter(prepareFilter(includeFilter), prepareFilter(excludeFilter)),
    [includeFilter, excludeFilter],
  );

  const getModuleFilterMultiplier = useCallback(
    (bundleId: string, data: { id: string }) => {
      return isIncluded(bundleId, data.id) ? 1 : 0;
    },
    [isIncluded],
  );

  return {
    getModuleFilterMultiplier,
    includeFilter,
    excludeFilter,
    setExcludeFilter: setExcludeFilterThrottled,
    setIncludeFilter: setIncludeFilterThrottled,
  };
};
