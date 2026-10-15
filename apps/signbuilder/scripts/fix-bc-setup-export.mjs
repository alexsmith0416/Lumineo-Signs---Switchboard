// Setup corrections applied to the BC export before importing it into the app
// (agreed with Alex Oct 15, 2026 — found by src/engine/real-setup.test.ts).
// Safe to run again, and on a fresh re-export from BC:
//
//   node apps/signbuilder/scripts/fix-bc-setup-export.mjs <export.json> <fixed.json>
//
// Once the app's setup tools exist, fix the setup there instead of adding here.
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node fix-bc-setup-export.mjs <export.json> <fixed.json>");
  process.exit(1);
}
const setup = JSON.parse(readFileSync(input, "utf8"));
const log = (msg) => console.log("  " + msg);

// 1. Monument — "Construction" (BUILD) offered only "Single cabinet", so the
//    types picked by the other answers (MON-DIR, MON-ROUTED) were unreachable.
const buildAnswers = [
  { value: "Directional", sortOrder: 20 },
  { value: "Pole cover / reveal / topper (routed faces)", sortOrder: 30 },
];
const monTypes = setup.signTypes.filter((t) => t["Category Code"] === "MONUMENT").map((t) => t.Code);
for (const type of monTypes) {
  const hasBuild = setup.questions.some((q) => q["Sign Type Code"] === type && q.Code === "BUILD");
  if (!hasBuild) continue;
  for (const a of buildAnswers) {
    const exists = setup.options.some((o) => o["Sign Type Code"] === type && o["Question Code"] === "BUILD" && o.Value === a.value);
    if (exists) continue;
    setup.options.push({
      "Sign Type Code": type,
      "Question Code": "BUILD",
      "Sort Order": a.sortOrder,
      Value: a.value,
      Hint: "",
      "Also Matches": "",
      "Code Segment": "",
    });
    log(`${type}: added "${a.value}" to Construction`);
  }
}

// 2. Wall Cabinet — WALL-CAB-NI had the lighted type's Selected When.
const ni = setup.signTypes.find((t) => t.Code === "WALL-CAB-NI");
if (ni && ni["Selected When"] !== "LIT=No; WORK=New cabinet") {
  ni["Selected When"] = "LIT=No; WORK=New cabinet";
  log("WALL-CAB-NI: Selected When → LIT=No; WORK=New cabinet");
}

// 3. Wall Cabinet — old types nothing can select: WALL-CAB-I/I duplicates
//    WALL-CAB-LIT, WALL-CAB-N/I is a 3-question stub. Deactivated, not deleted.
for (const code of ["WALL-CAB-I/I", "WALL-CAB-N/I"]) {
  const t = setup.signTypes.find((x) => x.Code === code);
  if (t && t.Active) {
    t.Active = false;
    log(`${code}: deactivated`);
  }
}

setup.fixesApplied = "fix-bc-setup-export.mjs (Oct 15, 2026)";
writeFileSync(output, JSON.stringify(setup));
console.log(`Wrote ${output}`);
