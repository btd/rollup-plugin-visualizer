import { render } from "preact";
import { html } from "htm/preact";

import Main from "./main.js";

import "../style/style-treemap.scss";

const drawChart = (parentNode, data, width, height) => {
  render(
    html` <${Main} data=${data} width=${width} height=${height} /> `,
    parentNode
  );
};

export default drawChart;
