import { rolldown, type OutputOptions } from "rolldown";
import { visualizer } from "rollup-plugin-visualizer";

rolldown({ input: "input.js", plugins: [visualizer()] });

visualizer((options: OutputOptions) => ({
  filename: options.file ?? "stats.html",
}));
