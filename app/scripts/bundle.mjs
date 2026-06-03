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

// Escape sequences that would prematurely close the surrounding tag when
// the HTML parser scans the inline payload. The JS / CSS runtimes treat
// the escaped form as identical to the original.
const safeJs = js.replace(/<\/(script)/gi, "<\\/$1");
const safeCss = css.replace(/<\/(style)/gi, "<\\/$1");

// Pass functions, not strings — string replacements interpret $&, $1, etc.,
// which minified bundles trip over and corrupt the output.
const inlined = html
  .replace(
    /<link rel="stylesheet"[^>]*>/,
    () => `<style>${safeCss}</style>`,
  )
  .replace(
    /<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,
    () => `<script type="module">${safeJs}</script>`,
  );

writeFileSync("../time-photo-prototype.html", inlined);
console.log(
  `Wrote ../time-photo-prototype.html (${(inlined.length / 1024).toFixed(1)} KB)`,
);
