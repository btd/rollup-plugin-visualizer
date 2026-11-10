import opn from "open";

import { renderTemplate } from "../render-template.js";
import { parseCliArgs } from "./options.js";
import {
  filterCompatibleReports,
  mergeReports,
  readReports,
  warnAboutMixedSettings,
  writeReport,
} from "./report.js";

export const runCli = async (args: string[]): Promise<void> => {
  const options = parseCliArgs(args);
  const reports = await readReports(options._ as string[]);
  const compatibleReports = filterCompatibleReports(reports);
  warnAboutMixedSettings(compatibleReports);
  const data = mergeReports(compatibleReports);
  const content = await renderTemplate(options.template, {
    title: options.title,
    data: JSON.stringify(data),
  });
  await writeReport(options.filename, content);

  if (options.open) {
    await opn(options.filename);
  }
};
