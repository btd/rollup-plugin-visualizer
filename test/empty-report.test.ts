import vm from "node:vm";
import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import treemap from "../src/treemap";
import treemapV2 from "../src/treemap-v2";
import treemap3d from "../src/treemap-3d";
import sunburst from "../src/sunburst";
import flamegraph from "../src/flamegraph";
import network from "../src/network";
import { FILTER_HTML, generateFilteredReport } from "./filtering-fixture";

// Exercise the real frontend entry points while observing their rendered VNodes.
// Browser smoke checks separately cover DOM rendering and chart initialization.
vi.mock("preact", async (importOriginal) => ({
  ...(await importOriginal<typeof import("preact")>()),
  render: vi.fn(),
}));

const charts = { treemap, "treemap-v2": treemapV2, "treemap-3d": treemap3d, sunburst, flamegraph, network };

describe("Empty report frontend entry points", () => {
  it.each([false, true])(
    "renders empty states and preserves graph-only networks: %s",
    async (graphOnly) => {
      const { reports } = await generateFilteredReport("rollup", {
        visualizer: graphOnly ? { include: { file: "external-dep" } } : { exclude: { file: "**" } },
        templates: [...FILTER_HTML],
      });
      for (const template of FILTER_HTML) {
        vi.mocked(render).mockClear();
        const handlers: Record<string, () => void> = {};
        const main = {};
        const bootstrap = [...reports[template].matchAll(/<script>([\s\S]*?)<\/script>/g)].at(
          -1,
        )![1];
        vm.runInNewContext(bootstrap, {
          window: {
            innerWidth: 1200,
            innerHeight: 800,
            addEventListener(name: string, fn: () => void) {
              handlers[name] = fn;
            },
          },
          document: {
            querySelector: () => main,
            addEventListener(name: string, fn: () => void) {
              handlers[name] = fn;
            },
          },
          drawChart: { default: charts[template] },
        });
        handlers.DOMContentLoaded();
        const assertRendered = () => {
          if (graphOnly && template === "network") {
            const vnode = vi.mocked(render).mock.lastCall![0];
            expect(vnode).toHaveProperty("props.value.data.nodeMetas");
            expect(vnode).not.toHaveProperty("type", "div");
          } else {
            expect(render).toHaveBeenLastCalledWith(
              expect.objectContaining({
                type: "div",
                props: { role: "status", children: "No modules to display." },
              }),
              main,
            );
          }
        };
        assertRendered();
        handlers.resize();
        assertRendered();
        expect(render).toHaveBeenCalledTimes(2);
      }
    },
  );
});
