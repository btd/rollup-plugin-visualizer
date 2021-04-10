import { COLOR_DEFAULT_OWN_SOURCE, COLOR_DEFAULT_VENDOR_SOURCE, COLOR_BASE, CssColor } from "../color";
import { NODE_MODULES } from "./util";

export const getModuleColor = ({ renderedLength, id }: { renderedLength: number; id: string }): CssColor =>
  renderedLength === 0 ? COLOR_BASE : NODE_MODULES.test(id) ? COLOR_DEFAULT_VENDOR_SOURCE : COLOR_DEFAULT_OWN_SOURCE;
