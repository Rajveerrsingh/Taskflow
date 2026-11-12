// Builds the static demo for GitHub Pages into dist/.
// The page is the same as public/, plus a bundled copy of the API logic
// (src/demo/browserApi.js) that runs in the browser instead of Express.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, "public"), dist, { recursive: true });

await build({
  entryPoints: [path.join(root, "src/demo/browserApi.js")],
  outfile: path.join(dist, "js/demo-api.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  alias: { "node:crypto": path.join(root, "src/demo/cryptoShim.js") },
  logLevel: "warning",
});

const htmlPath = path.join(dist, "index.html");
const html = await readFile(htmlPath, "utf8");
await writeFile(
  htmlPath,
  html.replace("<head>", '<head>\n    <meta name="taskflow-mode" content="demo" />'),
);
await writeFile(path.join(dist, ".nojekyll"), "");
console.log("Built static demo in dist/");
