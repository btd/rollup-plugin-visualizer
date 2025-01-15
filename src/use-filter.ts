import { useState, useMemo, useCallback } from "preact/hooks";
import { createFilter, FilterModel } from "../shared/create-filter";

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
  getModuleFilterMultiplier: (bundleId: string, data: { id: string }) => number;
  filterModel: string
  setFilterModel: (value: FilterModel) => void
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
  const [filterModel, setFilterModel] = useState<'glob' | 'regexp'>('glob') 

  const setIncludeFilterTrottled = useMemo(() => throttleFilter(setIncludeFilter, 200), []);
  const setExcludeFilterTrottled = useMemo(() => throttleFilter(setExcludeFilter, 200), []);

  const isIncluded = useMemo(
    () => createFilter(prepareFilter(includeFilter), prepareFilter(excludeFilter), filterModel),
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
    setExcludeFilter: setExcludeFilterTrottled,
    setIncludeFilter: setIncludeFilterTrottled,
    filterModel, 
    setFilterModel
  };
};
