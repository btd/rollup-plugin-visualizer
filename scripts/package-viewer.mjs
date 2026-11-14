import { promises as fs } from "node:fs";
import path from "node:path";
import { VISUAL_TEMPLATES } from "../dist/shared/share/url.js";

const root = path.resolve(import.meta.dirname, ".."),
  output = path.join(root, "dist/viewer");
await fs.mkdir(path.join(output, "assets"), { recursive: true });
await fs.copyFile(path.join(root, "src/viewer/index.html"), path.join(output, "index.html"));
await fs.copyFile(path.join(root, "src/viewer/style.css"), path.join(output, "assets/viewer.css"));
const template = await fs.readFile(path.join(root, "src/viewer/template.html"), "utf8");
for (const name of VISUAL_TEMPLATES) {
  await fs.mkdir(path.join(output, name), { recursive: true });
  await fs.writeFile(
    path.join(output, name, "index.html"),
    template.replaceAll("__TEMPLATE__", name),
  );
  for (const extension of ["js", "css"])
    await fs.copyFile(
      path.join(root, "dist/lib", `${name}.${extension}`),
      path.join(output, "assets", `${name}.${extension}`),
    );
}
await fs.writeFile(path.join(output, ".nojekyll"), "");
