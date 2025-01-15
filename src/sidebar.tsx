import { FunctionalComponent, JSX } from "preact";
import { useState } from "preact/hooks";
import { SizeKey } from "../shared/types";
import { LABELS } from "./sizes";
import { FilterModel } from "../shared/create-filter";

export interface SideBarProps {
  availableSizeProperties: SizeKey[];
  sizeProperty: SizeKey;
  setSizeProperty: (key: SizeKey) => void;
  onExcludeChange: (value: string) => void;
  onIncludeChange: (value: string) => void;
  defaultFilterValue?: string;
  onFilterModelChange: (value: FilterModel) => void
}

const PLACEHOLDER = "*/**/file.js";

export const SideBar: FunctionalComponent<SideBarProps> = ({
  availableSizeProperties,
  sizeProperty,
  setSizeProperty,
  onExcludeChange,
  onIncludeChange,
  defaultFilterValue = 'glob',
  onFilterModelChange
}) => {
  const [includeValue, setIncludeValue] = useState("");
  const [excludeValue, setExcludeValue] = useState("");

  const handleSizePropertyChange = (sizeProp: SizeKey) => () => {
    if (sizeProp !== sizeProperty) {
      setSizeProperty(sizeProp);
    }
  };

  const handleIncludeChange = (event: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const value = event.currentTarget.value;
    setIncludeValue(value);
    onIncludeChange(value);
  };

  const handleExcludeChange = (event: JSX.TargetedEvent<HTMLInputElement, Event>) => {
    const value = event.currentTarget.value;
    setExcludeValue(value);
    onExcludeChange(value);
  };

  const handleSelectFilterChange =  (event: JSX.TargetedEvent<HTMLSelectElement, Event>) => {
    const value = event.currentTarget.value;
    onFilterModelChange(value as FilterModel)
  }

  return (
    <aside className="sidebar">
      <div className="size-selectors">
        {availableSizeProperties.length > 1 &&
          availableSizeProperties.map((sizeProp) => {
            const id = `selector-${sizeProp}`;
            return (
              <div className="size-selector" key={sizeProp}>
                <input
                  type="radio"
                  id={id}
                  checked={sizeProp === sizeProperty}
                  onChange={handleSizePropertyChange(sizeProp)}
                />
                <label htmlFor={id}>{LABELS[sizeProp]}</label>
              </div>
            );
          })}
      </div>
      <div className="module-filters">
        <div className="module-filter">
          <label htmlFor="module-filter-exclude">Exclude</label>
          <input
            type="text"
            id="module-filter-exclude"
            value={excludeValue}
            onInput={handleExcludeChange}
            placeholder={PLACEHOLDER}
          />
        </div>
        <div className="module-filter">
          <label htmlFor="module-filter-include">Include</label>
          <input
            type="text"
            id="module-filter-include"
            value={includeValue}
            onInput={handleIncludeChange}
            placeholder={PLACEHOLDER}
          />
        </div>
        <div>
          <label style={{ width: '80px' }} htmlFor="module-filter-include">filterModel</label>
          <select id="patternType" defaultValue={defaultFilterValue} onChange={handleSelectFilterChange}>
            <option value="glob">glob model</option>
            <option value="regexp">regexp model</option>
          </select>
        </div>
      </div>
    </aside>
  );
};
