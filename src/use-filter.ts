import { useState, useMemo } from "preact/hooks";
import { ModuleRenderInfo } from "../types/types";

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
  getModuleFilterMultiplier: (data: ModuleRenderInfo) => number;
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
    const re = new RegExp(includeFilter);
    return ({ id }: ModuleRenderInfo) => re.test(id);
  }, [includeFilter]);

  const isModuleExcluded = useMemo(() => {
    if (excludeFilter === "") {
      return () => false;
    }
    const re = new RegExp(excludeFilter);
    return ({ id }: ModuleRenderInfo) => re.test(id);
  }, [excludeFilter]);

  const isDefaultInclude = includeFilter === "";

  const getModuleFilterMultiplier = useMemo(() => {
    return (data: ModuleRenderInfo) => {
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
