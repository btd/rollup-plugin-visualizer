// Packs the real tarball and typechecks it from isolated consumers that each have
// only one bundler installed. This is the end-to-end version of the invariant that
// plugin/bundler-types.ts exists to hold: the published .d.ts must not need a
// bundler we did not install. Each fixture runs tsc with skipLibCheck disabled,
// which is what surfaces a stray `import ... from "rollup"` as TS2307.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

// `forbids` is the load-bearing part: vite 8 depends on rolldown and ships no
// rollup at all, so asserting rollup is unresolvable proves the fixture really
// reproduces what a vite consumer has on disk.
const FIXTURES = [
  { name: "rollup-consumer", requires: ["rollup"], forbids: ["rolldown", "vite"] },
  { name: "rolldown-consumer", requires: ["rolldown"], forbids: ["rollup", "vite"] },
  { name: "vite-consumer", requires: ["vite", "rolldown"], forbids: ["rollup"] },
];

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

for (const { name, requires, forbids } of FIXTURES) {
  const consumerRoot = path.join(testRoot, name);
  cpSync(path.join(root, "test", "fixtures", name), consumerRoot, { recursive: true });

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
  for (const mod of requires) {
    assert.doesNotThrow(
      () => consumerRequire.resolve(mod),
      `${name} is missing ${mod}, so this fixture does not test what it claims`,
    );
  }
  for (const mod of forbids) {
    assert.throws(
      () => consumerRequire.resolve(mod),
      { code: "MODULE_NOT_FOUND" },
      `${name} unexpectedly installed ${mod}`,
    );
  }

  execFileSync("npm", ["exec", "--", "tsc", "--project", "tsconfig.json"], {
    cwd: consumerRoot,
    stdio: "inherit",
  });
  console.log(`${name}: ok`);
}
