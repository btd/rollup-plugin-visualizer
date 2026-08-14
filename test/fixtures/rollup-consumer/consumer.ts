import { rollup, type OutputOptions } from "rollup";
import { visualizer } from "rollup-plugin-visualizer";

rollup({ input: "input.js", plugins: [visualizer()] });

visualizer((options: OutputOptions) => ({
  filename: options.file ?? "stats.html",
}));
