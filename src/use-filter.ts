import { useState, useMemo } from "preact/hooks";

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

export const useFilter = (): UseFilter => {
  const [includeFilter, setIncludeFilter] = useState<string>("");
  const [excludeFilter, setExcludeFilter] = useState<string>("");

  const setIncludeFilterTrottled = useMemo(() => throttleFilter(setIncludeFilter, 200), []);
  const setExcludeFilterTrottled = useMemo(() => throttleFilter(setExcludeFilter, 200), []);

  const isModuleIncluded = useMemo(() => {
    if (includeFilter === "") {
      return () => true;
    }
    try {
      const re = new RegExp(includeFilter);
      return ({ id }: { id: string }) => re.test(id);
    } catch (err) {
      return () => false;
    }
  }, [includeFilter]);

  const isModuleExcluded = useMemo(() => {
    if (excludeFilter === "") {
      return () => false;
    }
    try {
      const re = new RegExp(excludeFilter);
      return ({ id }: { id: string }) => re.test(id);
    } catch (err) {
      return () => false;
    }
  }, [excludeFilter]);

  const isDefaultInclude = includeFilter === "";

  const getModuleFilterMultiplier = useMemo(() => {
    return (data: { id: string }) => {
      if (isDefaultInclude) {
        return isModuleExcluded(data) ? 0 : 1;
      }
      return isModuleExcluded(data) && !isModuleIncluded(data) ? 0 : 1;
    };
  }, [isDefaultInclude, isModuleExcluded, isModuleIncluded]);

  return {
    getModuleFilterMultiplier,
    includeFilter,
    excludeFilter,
    setExcludeFilter: setExcludeFilterTrottled,
    setIncludeFilter: setIncludeFilterTrottled,
  };
};
