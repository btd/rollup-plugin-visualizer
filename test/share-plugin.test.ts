import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { rollup } from "rollup";
import { rolldown } from "rolldown";
import { build } from "vite";
import { describe, expect, it, vi } from "vitest";
import { visualizer, type PluginVisualizerOptions } from "../dist/plugin/index.js";
import { decodeFragment } from "../dist/shared/share/transport.js";

const openBrowser = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("open", () => ({ default: openBrowser }));

const fixture = {
  name: "share-fixture",
  resolveId: (id: string) => id,
  load: () => "export const message = 'é😀' + Math.random();",
};

describe("plugin link output", () => {
  it.each(["rollup", "rolldown", "vite"] as const)(
    "prints a complete link without report files using %s",
    async (bundler) => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), "visualizer-link-"));
      const messages: string[] = [];
      const plugins = [
        fixture,
        visualizer({
          output: "link",
          template: "network",
          title: "分析😀",
          filename: path.join(dir, "ignored.html"),
        }),
      ];
      const onLog = (level: string, log: { message: string }) => {
        if (level === "info") messages.push(log.message.slice(log.message.indexOf("https://")));
      };
      let output;
      try {
        if (bundler === "vite") {
          const result = await build({
            configFile: false,
            publicDir: false,
            logLevel: "silent",
            plugins,
            build: {
              write: false,
              minify: false,
              rolldownOptions: { input: "/share.js", onLog, output: { format: "es" } },
            },
          });
          if (Array.isArray(result) || !("output" in result))
            throw new Error("Expected one output");
          output = result.output;
        } else {
          const bundle = await (bundler === "rollup"
            ? rollup({ input: "/share.js", plugins, onLog })
            : rolldown({ input: "/share.js", plugins, onLog }));
          try {
            output = (await bundle.generate({ format: "es" })).output;
          } finally {
            await bundle.close();
          }
        }
        expect(output.every((file) => file.type === "chunk")).toBe(true);
        expect(await fs.readdir(dir)).toEqual([]);
        expect(messages).toHaveLength(1);
        const url = new URL(messages[0]);
        expect(url.origin + url.pathname).toBe(
          "https://btd.github.io/rollup-plugin-visualizer/network/",
        );
        const decoded = await decodeFragment(url.hash);
        expect(decoded.title).toBe("分析😀");
        expect(Object.values(decoded.data.nodeMetas).map((meta) => meta.id)).toEqual(["/share.js"]);
        expect(Object.values(decoded.data.nodeParts)[0].renderedLength).toBeGreaterThan(0);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    },
  );

  it("opens the complete URL when requested", async () => {
    openBrowser.mockClear();
    const messages: string[] = [];
    const bundle = await rollup({
      input: "/share.js",
      plugins: [fixture, visualizer({ output: "link", open: true })],
      onLog(level, log) {
        if (level === "info") messages.push(log.message.slice(log.message.indexOf("https://")));
      },
    });
    try {
      await bundle.generate({ format: "es" });
      expect(openBrowser).toHaveBeenCalledExactlyOnceWith(messages[0], {});
      expect(new URL(messages[0]).pathname).toBe("/rollup-plugin-visualizer/treemap/");
    } finally {
      await bundle.close();
    }
  });

  it.each([
    { output: "other" },
    { output: "link", emitFile: true },
    ...["raw-data", "markdown", "list"].map((template) => ({ output: "link", template })),
    { output: "link", json: true },
  ])("rejects unsupported options before creating reports: %j", async (options) => {
    const bundle = await rollup({
      input: "/share.js",
      plugins: [fixture, visualizer(options as PluginVisualizerOptions)],
      onwarn: () => {},
    });
    try {
      await expect(bundle.generate({ format: "es" })).rejects.toThrow(/output|link/i);
    } finally {
      await bundle.close();
    }
  });

  it("evaluates options for every output without mutating the supplied object", async () => {
    const formats: unknown[] = [],
      messages: string[] = [];
    const options = Object.freeze({
      output: "link" as const,
      template: "sunburst" as const,
      json: false,
    });
    const bundle = await rollup({
      input: "/share.js",
      plugins: [
        fixture,
        visualizer((output) => {
          formats.push(output.file);
          return options;
        }),
      ],
      onwarn: () => {},
      onLog(level, log) {
        if (level === "info") messages.push(log.message.slice(log.message.indexOf("https://")));
      },
    });
    try {
      await bundle.generate({ format: "es", file: "one.js" });
      await bundle.generate({ format: "cjs", file: "two.js" });
      expect(formats).toEqual(["one.js", "two.js"]);
      expect(messages).toHaveLength(2);
      expect(messages.every((message) => new URL(message).pathname.endsWith("/sunburst/"))).toBe(
        true,
      );
    } finally {
      await bundle.close();
    }
  });
});
