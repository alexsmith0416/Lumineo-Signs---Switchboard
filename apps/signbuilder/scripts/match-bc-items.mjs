// Proposes a BC item for every material answer (and vinyl color) in a setup
// export, using the app's matcher (src/setup/item-match.ts):
//
//   node apps/signbuilder/scripts/match-bc-items.mjs <setup.json> <items.csv> <outDir>
//
// items.csv comes from scripts/bc-items-probe.ps1 (company data — not in git).
// Writes <outDir>/item-matches.md for review.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SIGN_ITEM_CATEGORIES, describeItems, describeMaterial, suggestItems } from "../src/setup/item-match.ts";
import { readItemsCsv } from "./items-csv.mjs";

const [setupFile, itemsFile, outDir] = process.argv.slice(2);
if (!setupFile || !itemsFile || !outDir) {
  console.error("usage: node match-bc-items.mjs <setup.json> <items.csv> <outDir>");
  process.exit(1);
}

const setup = JSON.parse(readFileSync(setupFile, "utf8"));
const items = readItemsCsv(readFileSync(itemsFile, "utf8")).filter((i) => SIGN_ITEM_CATEGORIES.includes(i.category));
const described = describeItems(items);

const byValue = new Map();
for (const o of setup.options) {
  const v = String(o.Value);
  const e = byValue.get(v);
  if (e) e.uses++;
  else if (describeMaterial(v).family) byValue.set(v, { value: v, uses: 1 });
}
const rows = [...byValue.values()].map((e) => {
  const s = suggestItems(e.value, items, described);
  const tie = s.filter((x) => x.score === s[0]?.score);
  return { ...e, s, confidence: !s.length ? "none" : tie.length > 1 ? "pick" : s[0].score >= 20 ? "high" : "medium" };
});
const vinyl = (setup.vinylColors ?? []).map((c) => ({ c, s: suggestItems(`${c.Code} ${c.Name} vinyl`, items, described) }));

const md = [`# Answers ↔ BC items\n`];
const count = (c) => rows.filter((r) => r.confidence === c).length;
md.push(`${rows.length} material answers: ${count("high")} high, ${count("medium")} medium, ${count("pick")} pick, ${count("none")} none. Vinyl colors: ${vinyl.filter((v) => v.s.length).length}/${vinyl.length}. Items in scope: ${items.length}.\n`);
for (const c of ["high", "medium", "pick", "none"]) {
  md.push(`\n## ${c}\n`);
  for (const r of rows.filter((x) => x.confidence === c)) {
    const [top, ...rest] = r.s;
    md.push(`- \`${r.value}\` (${r.uses}×) → ${top ? `#${top.item.no} ${top.item.name} [${top.item.category}] (${top.score})` : "—"}${rest.length ? `  · also: ${rest.slice(0, 4).map((x) => `${x.item.no} ${x.item.name} (${x.score})`).join("; ")}` : ""}`);
  }
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "item-matches.md"), md.join("\n"));
console.log(md[1]);
