import { FunctionalComponent } from "preact";
import { SizeKey } from "../types/types";
import { LABELS } from "./sizes";

export interface SideBarProps {
  availableSizeProperties: SizeKey[];
  sizeProperty: SizeKey;
  setSizeProperty: (key: SizeKey) => void;
  onExcludeChange: (value: string) => void;
  excludeValue: string;
  onIncludeChange: (value: string) => void;
  includeValue: string;
}

export const SideBar: FunctionalComponent<SideBarProps> = ({
  availableSizeProperties,
  sizeProperty,
  setSizeProperty,
  includeValue,
  excludeValue,
  onExcludeChange,
  onIncludeChange,
}) => {
  const handleChange = (sizeProp: SizeKey) => () => {
    if (sizeProp !== sizeProperty) {
      setSizeProperty(sizeProp);
    }
  };

  return (
    <aside className="sidebar">
      <div className="size-selectors">
        {availableSizeProperties.length > 1 &&
          availableSizeProperties.map((sizeProp) => {
            const id = `selector-${sizeProp}`;
            return (
              <div className="size-selector" key={sizeProp}>
                <input type="radio" id={id} checked={sizeProp === sizeProperty} onChange={handleChange(sizeProp)} />
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
            value={excludeValue ?? ""}
            onInput={(event) => {
              onExcludeChange(event.currentTarget.value);
            }}
          />
        </div>
        <div className="module-filter">
          <label htmlFor="module-filter-include">Include</label>
          <input
            type="text"
            id="module-filter-include"
            value={includeValue ?? ""}
            onInput={(event) => {
              onIncludeChange(event.currentTarget.value);
            }}
          />
        </div>
      </div>
    </aside>
  );
};
