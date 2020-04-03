import { foo } from "./lib.js";

async function main() {
  foo();
  await import("./dynamic.js");
}

main();
