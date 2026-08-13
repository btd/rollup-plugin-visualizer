import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const testRoot = mkdtempSync(path.join(tmpdir(), "visualizer-consumers-"));
process.on("exit", () => rmSync(testRoot, { recursive: true, force: true }));

const npm = (...args) =>
  execFileSync("npm", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();

const packed = JSON.parse(npm("pack", "--json", "--pack-destination", testRoot))[0].filename;
const tarball = path.join(testRoot, packed);

for (const bundler of ["rollup", "rolldown"]) {
  const consumerRoot = path.join(testRoot, bundler);
  const otherBundler = bundler === "rollup" ? "rolldown" : "rollup";
  cpSync(path.join(root, "test", "fixtures", `${bundler}-consumer`), consumerRoot, {
    recursive: true,
  });

  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--omit=optional",
      "--prefer-offline",
      tarball,
    ],
    { cwd: consumerRoot, stdio: "inherit" },
  );

  const consumerRequire = createRequire(path.join(consumerRoot, "package.json"));
  assert.doesNotThrow(() => consumerRequire.resolve(bundler));
  assert.throws(
    () => consumerRequire.resolve(otherBundler),
    { code: "MODULE_NOT_FOUND" },
    `${bundler}-only consumer unexpectedly installed ${otherBundler}`,
  );

  execFileSync("npm", ["exec", "--", "tsc", "--project", "tsconfig.json"], {
    cwd: consumerRoot,
    stdio: "inherit",
  });
}
