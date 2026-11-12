import { render } from "preact";

export const renderEmptyReport = (parentNode: Element): void => {
  render(<div role="status">No modules to display.</div>, parentNode);
};
