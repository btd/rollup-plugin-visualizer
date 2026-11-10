import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { rolldown, type RolldownPlugin } from "rolldown";
import { rollup } from "rollup";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { visualizer } from "../dist/plugin/index.js";
import templates from "../dist/plugin/template-types.js";
import type { VisualizerData } from "../shared/types.js";

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "dist/bin/cli.js");

// This is a starting point for the CLI contract, not an exhaustive definition:
// missing coverage does not mean an existing behavior is unsupported.
describe("CLI contract", () => {
  let cwd: string;
  let reports: Record<"rollup" | "rolldown", string>;
  let rollupData: VisualizerData;
  let rolldownData: VisualizerData;
  let packageVersion: string;

  beforeAll(async () => {
    const generateReport = async (bundler: "rollup" | "rolldown") => {
      const input = path.join(root, "test/sourcemap-encoding/input.js");
      const plugins = [
        visualizer({
          template: "raw-data",
          filename: "report.json",
          emitFile: true,
          gzipSize: true,
          brotliSize: true,
          projectRoot: root,
        }),
      ];
      const bundle =
        bundler === "rollup"
          ? await rollup({ input, plugins })
          : await rolldown({ input, plugins: plugins as RolldownPlugin[] });

      try {
        const { output } = await bundle.generate({ format: "es", entryFileNames: `${bundler}.js` });
        const report = output.find((file) => file.fileName === "report.json");
        if (report?.type !== "asset") throw new Error(`${bundler} did not emit its report`);
        return String(report.source);
      } finally {
        await bundle.close();
      }
    };

    reports = {
      rollup: await generateReport("rollup"),
      rolldown: await generateReport("rolldown"),
    };
    rollupData = JSON.parse(reports.rollup);
    rolldownData = JSON.parse(reports.rolldown);
    packageVersion = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
  }, 30_000);

  beforeEach(async () => {
    cwd = await mkdtemp(path.join(tmpdir(), "visualizer-cli-"));
    await writeFile(path.join(cwd, "rollup.json"), reports.rollup);
    await writeFile(path.join(cwd, "rolldown.json"), reports.rolldown);
  });

  afterEach(async () => {
    if (cwd) await rm(cwd, { recursive: true, force: true });
  });

  const run = (args: string[]) => {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: "utf8",
      timeout: 10_000,
    });
    if (result.error) throw result.error;
    expect(result.signal).toBeNull();
    expect(result.status).not.toBeNull();
    return result;
  };

  const readReport = async (filename = "result.json"): Promise<VisualizerData> =>
    JSON.parse(await readFile(path.join(cwd, filename), "utf8"));

  const expectRollupReport = (data: VisualizerData) => {
    expect(data).toEqual({
      ...rollupData,
      tree: { name: "root", children: rollupData.tree.children },
    });
  };

  it("writes stats.html with the default title", async () => {
    const result = run(["rollup.json"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    const html = await readFile(path.join(cwd, "stats.html"), "utf8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Rollup Visualizer</title>");
    expect(html).toContain(Object.keys(rollupData.nodeParts)[0]);
  });

  it.each(["separated", "equals"])(
    "accepts %s string options and creates nested output directories",
    async (syntax) => {
      const filename = "réports/图.html";
      const title = "Résumé & <bundle> 🌍";
      const options =
        syntax === "separated"
          ? ["--filename", filename, "--title", title, "--template", "treemap"]
          : [`--filename=${filename}`, `--title=${title}`, "--template=treemap"];
      const result = run([...options, "rollup.json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      const html = await readFile(path.join(cwd, filename), "utf8");
      expect(html).toContain("<title>Résumé &amp; &lt;bundle&gt; 🌍</title>");
    },
  );

  it("merges Rollup and Rolldown reports with options before, between, and after files", async () => {
    const result = run([
      "--template",
      "raw-data",
      "rollup.json",
      "--filename=combined.json",
      "rolldown.json",
      "--title",
      "Combined",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    const data = await readReport("combined.json");
    expect(data.version).toBe(rollupData.version);
    expect(data.tree).toEqual({
      name: "root",
      children: [...rollupData.tree.children, ...rolldownData.tree.children],
    });
    expect(data.nodeParts).toEqual({ ...rollupData.nodeParts, ...rolldownData.nodeParts });
    expect(data.nodeMetas).toEqual({ ...rollupData.nodeMetas, ...rolldownData.nodeMetas });
    expect(Object.keys(data.nodeParts)).toHaveLength(
      Object.keys(rollupData.nodeParts).length + Object.keys(rolldownData.nodeParts).length,
    );
    expect(Object.values(data.nodeMetas).some((meta) => meta.imported.length > 0)).toBe(true);
    expect(data.env).toEqual(rollupData.env);
    expect(data.options).toEqual(rollupData.options);
  });

  it.each([
    { files: ["unsupported.json", "rollup.json"] },
    { files: ["rollup.json", "unsupported.json"] },
  ])("skips unsupported reports and uses compatible metadata: $files", async ({ files }) => {
    await writeFile(
      path.join(cwd, "unsupported.json"),
      JSON.stringify({
        ...rolldownData,
        version: rollupData.version + 1,
        env: { unsupported: true },
        options: { gzip: false, brotli: false, sourcemap: true },
      }),
    );
    const result = run(["--template=raw-data", "--filename=result.json", ...files]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("unsupported.json");
    expect(result.stderr).toContain("not supported");
    expect(result.stderr).toContain("Skipping");
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expectRollupReport(await readReport());
  });

  it.each([false, true])(
    "fails without writing when all reports are unsupported (existing output: %s)",
    async (existingOutput) => {
      for (const [filename, data] of [
        ["rollup.json", rollupData],
        ["rolldown.json", rolldownData],
      ] as const) {
        await writeFile(
          path.join(cwd, filename),
          JSON.stringify({ ...data, version: data.version + 1 }),
        );
      }
      if (existingOutput) await writeFile(path.join(cwd, "result.json"), "previous report");
      const result = run([
        "--template=raw-data",
        "--filename=result.json",
        "rollup.json",
        "rolldown.json",
      ]);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("rollup.json");
      expect(result.stderr).toContain("rolldown.json");
      expect(result.stderr).toContain("No compatible reports");
      if (existingOutput) {
        expect(await readFile(path.join(cwd, "result.json"), "utf8")).toBe("previous report");
      } else {
        expect(await readdir(cwd)).not.toContain("result.json");
      }
    },
  );

  it.each(
    (["gzip", "brotli", "sourcemap"] as const).flatMap((setting) => [
      { setting, reversed: false },
      { setting, reversed: true },
    ]),
  )(
    "warns about different measurement settings: $setting (reversed: $reversed)",
    async ({ setting, reversed }) => {
      const differentReport = {
        ...rolldownData,
        options: { ...rolldownData.options, [setting]: !rolldownData.options[setting] },
      };
      await writeFile(path.join(cwd, "rolldown.json"), JSON.stringify(differentReport));
      const files = reversed ? ["rolldown.json", "rollup.json"] : ["rollup.json", "rolldown.json"];
      const result = run(["--template=raw-data", "--filename=result.json", ...files]);

      expect(result.status).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr.trim().split("\n")).toHaveLength(1);
      expect(result.stderr).toContain("rollup.json");
      expect(result.stderr).toContain("rolldown.json");
      expect(result.stderr).toContain(setting);
      expect(result.stderr).toContain(`Using settings from ${files[0]}`);
      const data = await readReport();
      expect(data.options).toEqual(reversed ? differentReport.options : rollupData.options);
      expect(Object.keys(data.nodeParts)).toHaveLength(
        Object.keys(rollupData.nodeParts).length + Object.keys(rolldownData.nodeParts).length,
      );
    },
  );

  it("warns once per report when multiple measurement settings differ", async () => {
    await writeFile(
      path.join(cwd, "rolldown.json"),
      JSON.stringify({
        ...rolldownData,
        options: { gzip: false, brotli: false, sourcemap: true },
      }),
    );
    const result = run([
      "--template=raw-data",
      "--filename=result.json",
      "rollup.json",
      "rolldown.json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    for (const setting of ["gzip", "brotli", "sourcemap"]) {
      expect(result.stderr).toContain(setting);
    }
  });

  it.each([
    { filename: "123", separator: [] },
    { filename: "00123", separator: [] },
    { filename: "123", separator: ["--"] },
  ])(
    "reads numeric filenames without coercion: $filename (separator: $separator)",
    async ({ filename, separator }) => {
      await writeFile(path.join(cwd, filename), reports.rollup);
      const result = run(["--template=raw-data", "--filename=result.json", ...separator, filename]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expectRollupReport(await readReport());
    },
  );

  it("reads Unicode input paths", async () => {
    await writeFile(path.join(cwd, "données-🌍.json"), reports.rollup);
    const result = run(["--template=raw-data", "--filename=result.json", "données-🌍.json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expectRollupReport(await readReport());
  });

  it.each(["--sourcemap", "--no-sourcemap", "--sourcemap=false"])(
    "treats %s after -- as a filename without warning",
    async (filename) => {
      await writeFile(path.join(cwd, filename), reports.rollup);
      const result = run(["--template=raw-data", "--filename=result.json", "--", filename]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expectRollupReport(await readReport());
    },
  );

  it.each([
    { args: ["--title=--sourcemap", "--filename=result.json"], filename: "result.json" },
    { args: ["--filename=--no-sourcemap"], filename: "--no-sourcemap" },
  ])(
    "does not warn for sourcemap text in another option's value: $args",
    async ({ args, filename }) => {
      const result = run(["--template=raw-data", ...args, "rollup.json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expectRollupReport(await readReport(filename));
    },
  );

  it.each([
    { args: ["--sourcemap"] },
    { args: ["--no-sourcemap"] },
    { args: ["--sourcemap=true"] },
    { args: ["--sourcemap=false"] },
    { args: ["--sourcemap", "true"] },
    { args: ["--sourcemap", "false"] },
    { args: ["--sourcemap", "--no-sourcemap", "--sourcemap=false"] },
  ])("warns once on explicit sourcemap usage: $args", async ({ args }) => {
    const result = run([...args, "--template=raw-data", "--filename=result.json", "rollup.json"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect(result.stderr).toContain("CLI --sourcemap");
    expect(result.stderr).toContain("deprecated");
    expect(result.stderr).toContain("no effect");
    expect(result.stderr).toContain("raw-data JSON");
    expectRollupReport(await readReport());
  });

  it.each([
    { args: ["--help"] },
    { args: ["--help", "--sourcemap"] },
    { args: ["--no-sourcemap", "--help"] },
  ])("prints help without warnings or output files: $args", async ({ args }) => {
    const result = run(args);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    for (const option of [
      "filename",
      "title",
      "template",
      "open",
      "sourcemap",
      "help",
      "version",
    ]) {
      expect(result.stdout).toContain(`--${option}`);
    }
    for (const template of templates) {
      expect(result.stdout).toContain(template);
    }
    expect(result.stdout).toContain("Deprecated");
    expect((await readdir(cwd)).toSorted()).toEqual(["rolldown.json", "rollup.json"]);
  });

  it.each([{ args: ["--version"] }, { args: ["--sourcemap=false", "--version"] }])(
    "prints the package version without warnings or output files: $args",
    async ({ args }) => {
      const result = run(args);

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(packageVersion);
      expect(result.stderr).toBe("");
      expect((await readdir(cwd)).toSorted()).toEqual(["rolldown.json", "rollup.json"]);
    },
  );

  it.each([
    { name: "no inputs", args: [] },
    { name: "invalid template", args: ["--template=unsupported", "rollup.json"] },
    { name: "missing file", args: ["missing.json"] },
    { name: "malformed JSON", args: ["invalid.json"] },
  ])("fails with a diagnostic and preserves existing output for $name", async ({ args }) => {
    await writeFile(path.join(cwd, "invalid.json"), "{ invalid JSON");
    await writeFile(path.join(cwd, "stats.html"), "existing report");
    const result = run(args);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim().length).toBeGreaterThan(0);
    expect(await readFile(path.join(cwd, "stats.html"), "utf8")).toBe("existing report");
  });
});
