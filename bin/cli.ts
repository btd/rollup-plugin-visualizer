#!/usr/bin/env node

import { hideBin } from "yargs/helpers";

import { runCli } from "../plugin/cli/index.js";
import { warn } from "../plugin/warn.js";

runCli(hideBin(process.argv)).catch((err: Error) => {
  warn(err.message);
  process.exit(1);
});
