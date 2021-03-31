import { FunctionalComponent } from "preact";
import { SizeKey } from "../types/types";
import { LABELS } from "./sizes";

export interface SideBarProps {
  availableSizeProperties: SizeKey[];
  sizeProperty: SizeKey;
  setSizeProperty: (key: SizeKey) => void;
}

export const SideBar: FunctionalComponent<SideBarProps> = ({
  availableSizeProperties,
  sizeProperty,
  setSizeProperty,
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
    </aside>
  );
};
