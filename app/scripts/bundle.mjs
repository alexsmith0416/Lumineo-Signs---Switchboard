import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distDir = "dist";
const assetsDir = join(distDir, "assets");

const html = readFileSync(join(distDir, "index.html"), "utf8");

const cssFile = readdirSync(assetsDir).find((f) => f.endsWith(".css"));
const jsFile = readdirSync(assetsDir).find((f) => f.endsWith(".js"));

if (!cssFile || !jsFile) {
  throw new Error("missing built assets");
}

const css = readFileSync(join(assetsDir, cssFile), "utf8");
const js = readFileSync(join(assetsDir, jsFile), "utf8");

const inlined = html
  .replace(
    /<link rel="stylesheet"[^>]*>/,
    `<style>${css}</style>`,
  )
  .replace(
    /<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,
    `<script type="module">${js}</script>`,
  );

writeFileSync("../time-photo-prototype.html", inlined);
console.log(
  `Wrote ../time-photo-prototype.html (${(inlined.length / 1024).toFixed(1)} KB)`,
);
