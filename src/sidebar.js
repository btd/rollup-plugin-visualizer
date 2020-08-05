import { html } from "htm/preact";

import { LABELS } from "./sizes";

const SideBar = ({
  availableSizeProperties,
  sizeProperty,
  setSizeProperty,
}) => {
  const handleChange = (sizeProp) => () => {
    if (sizeProp !== sizeProperty) {
      setSizeProperty(sizeProp);
    }
  };
  return html`
    <aside class="sidebar">
      <div class="size-selectors">
        ${availableSizeProperties.length > 1 &&
        availableSizeProperties.map((sizeProp) => {
          const id = `selector-${sizeProp}`;
          return html`
            <div class="size-selector">
              <input
                type="radio"
                id=${id}
                checked=${sizeProp === sizeProperty}
                onChange=${handleChange(sizeProp)}
              />
              <label for=${id}>
                ${LABELS[sizeProp]}
              </label>
            </div>
          `;
        })}
      </div>
    </aside>
  `;
};

export default SideBar;
