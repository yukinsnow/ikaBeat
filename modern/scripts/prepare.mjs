import { mkdir, copyFile } from "node:fs/promises";
await mkdir("public/vendor", { recursive: true });
for (const name of ["essentia-wasm.umd.js", "essentia.js-core.js"]) {
  await copyFile(
    `node_modules/essentia.js/dist/${name}`,
    `public/vendor/${name}`,
  );
}
await copyFile(
  "node_modules/essentia.js/LICENSE",
  "public/vendor/ESSENTIA-LICENSE.txt",
);
