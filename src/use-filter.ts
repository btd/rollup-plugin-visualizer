import { useState, useMemo, useCallback } from "preact/hooks";

import "./create-filter";
import createFilter from "./create-filter";

export type FilterSetter = (value: string) => void;

const throttleFilter = (callback: FilterSetter, limit: number): typeof callback => {
  let waiting = false;
  return (val: string): void => {
    if (!waiting) {
      callback(val);
      waiting = true;
      setTimeout(() => {
        waiting = false;
      }, limit);
    }
  };
};

export type UseFilter = {
  includeFilter: string;
  excludeFilter: string;
  setIncludeFilter: FilterSetter;
  setExcludeFilter: FilterSetter;
  getModuleFilterMultiplier: (data: { id: string }) => number;
};

const prepareFilter = (filt: string) => {
  if (filt === "") return [];
  return filt
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry);
};

export const useFilter = (): UseFilter => {
  const [includeFilter, setIncludeFilter] = useState<string>("");
  const [excludeFilter, setExcludeFilter] = useState<string>("");

  const setIncludeFilterTrottled = useMemo(() => throttleFilter(setIncludeFilter, 200), []);
  const setExcludeFilterTrottled = useMemo(() => throttleFilter(setExcludeFilter, 200), []);

  const isIncluded = useMemo(
    () => createFilter(prepareFilter(includeFilter), prepareFilter(excludeFilter)),
    [includeFilter, excludeFilter]
  );

  const getModuleFilterMultiplier = useCallback(
    (data: { id: string }) => {
      return isIncluded(data.id) ? 1 : 0;
    },
    [isIncluded]
  );

  return {
    getModuleFilterMultiplier,
    includeFilter,
    excludeFilter,
    setExcludeFilter: setExcludeFilterTrottled,
    setIncludeFilter: setIncludeFilterTrottled,
  };
};
