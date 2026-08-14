import { defineConfig, type PluginOption } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

// vite 8 depends on rolldown and ships no rollup, so this fixture is the one that
// proves the published types resolve for the majority of consumers.
export default defineConfig({
  plugins: [visualizer()],
});

export const asPluginOption: PluginOption = visualizer();

visualizer((options) => ({
  filename: options.file ?? "stats.html",
}));
