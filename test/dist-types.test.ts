import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The published .d.ts files must not import from rollup/rolldown/vite. Consumers
// only install one of them (vite 8 ships neither rollup nor its types), so such an
// import resolves to nothing: silently `any` under skipLibCheck, TS2307 without it.
// plugin/bundler-types.ts exists to keep this true.

const DIST = path.join(import.meta.dirname, "..", "dist");
const BUNDLERS = ["rollup", "rolldown", "vite"];

describe("published types", () => {
  it("do not import from any bundler", async () => {
    const entries = await readdir(DIST, { recursive: true, withFileTypes: true });
    const declarations = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".d.ts"))
      .map((entry) => path.join(entry.parentPath, entry.name));

    expect(declarations.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of declarations) {
      const source = await readFile(file, "utf-8");
      for (const bundler of BUNDLERS) {
        // `from "rollup"`, `import("rollup")`, `require("rollup")` — but not comments
        const pattern = new RegExp(`(?:from|import|require)\\s*\\(?\\s*["']${bundler}["']`);
        if (pattern.test(source)) {
          offenders.push(`${path.relative(DIST, file)} imports "${bundler}"`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
