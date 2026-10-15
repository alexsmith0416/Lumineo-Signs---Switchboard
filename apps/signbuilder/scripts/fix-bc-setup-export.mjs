// Setup corrections applied to the BC export before importing it into the app
// (agreed with Alex Oct 15, 2026 — found by src/engine/real-setup.test.ts).
// Safe to run again, and on a fresh re-export from BC:
//
//   node apps/signbuilder/scripts/fix-bc-setup-export.mjs <export.json> <fixed.json> [items.csv]
//
// Once the app's setup tools exist, fix the setup there instead of adding here.
import { readFileSync, writeFileSync } from "node:fs";

const [input, output, itemsCsv] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node fix-bc-setup-export.mjs <export.json> <fixed.json> [items.csv]");
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

// --- Round 2 (Alex, Oct 15 — found by Check Setup) ------------------------------

// 4. The "Tenant Panel" category has no sign types — it led nowhere.
const tenant = setup.categories.find((c) => c.Code === "TENANTPANELS");
if (tenant && tenant.Active) {
  tenant.Active = false;
  log("TENANTPANELS: category deactivated (no sign types)");
}

// 5. Monument Directional / Routed: rules standing on an answer their trigger
//    question doesn't offer ("Flex Face" — routed faces have no flex) never fire.
const hasOption = (type, q, value) =>
  setup.options.some((o) => o["Sign Type Code"] === type && o["Question Code"] === q && String(o.Value).toLowerCase() === String(value).toLowerCase());
const isListQ = (type, q) => {
  const row = setup.questions.find((x) => x["Sign Type Code"] === type && x.Code === q);
  return row && (row["Answer Type"] === 0 || row["Answer Type"] === 4);
};
const before = setup.rules.length;
setup.rules = setup.rules.filter((r) => {
  const type = r["Sign Type Code"];
  if (type !== "MON-DIR" && type !== "MON-ROUTED") return true;
  const dead = r["Trigger Answer"] && isListQ(type, r["Trigger Question Code"]) && !hasOption(type, r["Trigger Question Code"], r["Trigger Answer"]);
  if (dead) log(`${type}: removed dead rule ${r["Trigger Question Code"]}="${r["Trigger Answer"]}" → ${r["Target Question Code"]}`);
  return !dead;
});
if (setup.rules.length === before) log("MON-DIR / MON-ROUTED: no dead rules left");
// …and the Conditional questions only those rules showed (Flex face, Flex frame
// material — no flex face on these types) are now never asked: removed too.
for (const type of ["MON-DIR", "MON-ROUTED"]) {
  const orphans = setup.questions.filter(
    (q) =>
      q["Sign Type Code"] === type &&
      q.Scope === 1 &&
      q.Stage !== 3 &&
      /FLEX/.test(q.Code) &&
      !setup.rules.some((r) => r["Sign Type Code"] === type && r["Target Question Code"] === q.Code && !r["Target Answer"]),
  );
  for (const q of orphans) {
    setup.questions = setup.questions.filter((x) => x !== q);
    setup.options = setup.options.filter((o) => !(o["Sign Type Code"] === type && o["Question Code"] === q.Code));
    setup.rules = setup.rules.filter((r) => !(r["Sign Type Code"] === type && (r["Target Question Code"] === q.Code || r["Trigger Question Code"] === q.Code)));
    log(`${type}: removed never-asked question ${q.Code} ("${q.Prompt}")`);
  }
}

// 6. Aluminum Pan – Wall Mounted: one Face frame + one Mounting frame question
//    whose default follows Pan depth (Default Rules, app-only), instead of a
//    copy of each per depth (BC couldn't make a default depend on an answer).
//    The per-depth copies' defaults become the rules: 1” → 1”x1.5” / 3/4”x1.5”,
//    1.5” → 1.5”x1.5” / 2”x1”, 2” → 2”x2” / 1.5”x1.5”, 3” → 3”x3” / 2”x2”.
setup.defaultRules = setup.defaultRules ?? [];
const PAN = "PAN-WALL";
for (const [general, prefix] of [["FACE_FRAME_X", "FACE_FRAME_"], ["MOUNT_FRAME_X", "MOUNT_FRAME_"]]) {
  const perDepth = setup.questions.filter((q) => q["Sign Type Code"] === PAN && q.Code.startsWith(prefix) && q.Code !== general && /^\w+_(1|15|2|3)$/.test(q.Code));
  if (perDepth.length === 0) continue; // already done
  for (const q of perDepth) {
    const showRule = setup.rules.find((r) => r["Sign Type Code"] === PAN && r["Target Question Code"] === q.Code && r["Trigger Question Code"] === "PAN_DEPTH");
    if (showRule && q["Default Value"]) {
      setup.defaultRules.push({
        "Sign Type Code": PAN,
        "Trigger Question Code": "PAN_DEPTH",
        "Trigger Answer": showRule["Trigger Answer"],
        "Target Question Code": general,
        "Default Value": q["Default Value"],
      });
      log(`${PAN}: Pan depth ${showRule["Trigger Answer"]} → ${general} defaults to ${q["Default Value"]}`);
    }
  }
  const gone = new Set(perDepth.map((q) => q.Code));
  setup.questions = setup.questions.filter((q) => !(q["Sign Type Code"] === PAN && gone.has(q.Code)));
  setup.options = setup.options.filter((o) => !(o["Sign Type Code"] === PAN && gone.has(o["Question Code"])));
  setup.rules = setup.rules.filter((r) => !(r["Sign Type Code"] === PAN && (gone.has(r["Target Question Code"]) || gone.has(r["Trigger Question Code"]))));
  log(`${PAN}: removed per-depth questions ${[...gone].join(", ")}`);
  // Asked once Pan depth is answered (any depth — a typed depth has no default).
  if (!setup.rules.some((r) => r["Sign Type Code"] === PAN && r["Target Question Code"] === general && r["Trigger Question Code"] === "PAN_DEPTH")) {
    setup.rules.push({ "Sign Type Code": PAN, "Trigger Question Code": "PAN_DEPTH", "Trigger Answer": "", "Target Question Code": general, "Target Answer": "" });
    log(`${PAN}: ${general} shown once Pan depth is answered`);
  }
}

// --- Round 4 (Alex, Oct 15): answers that had no BC item --------------------------
// Renamed to the stocked item (and linked), everywhere the wording is used:
// answers, question defaults, default rules, Spec Rules, template / reference /
// "also requires" conditions and Selected When.
const splitVals = (s) => String(s ?? "").split("|");
const swapIn = (s, from, to) => {
  const v = String(s ?? "");
  const not = v.startsWith("!");
  const parts = splitVals(not ? v.slice(1) : v).map((x) => (x.trim().toLowerCase() === from.toLowerCase() ? to : x));
  return (not ? "!" : "") + parts.join("|");
};
function renameAnswer(from, to, itemNo) {
  let n = 0;
  const seen = new Set(setup.options.filter((o) => o.Value === to).map((o) => `${o["Sign Type Code"]}|${o["Question Code"]}`));
  setup.options = setup.options.filter((o) => {
    if (o.Value !== from) return true;
    n++;
    const k = `${o["Sign Type Code"]}|${o["Question Code"]}`;
    if (seen.has(k)) return false; // the question already offers the new wording
    seen.add(k);
    o.Value = to;
    if (itemNo) o["Item No."] = itemNo;
    return true;
  });
  for (const q of setup.questions) {
    if (q["Default Value"] === from) q["Default Value"] = to;
    if (q["And Show If Values"]) q["And Show If Values"] = swapIn(q["And Show If Values"], from, to);
  }
  for (const r of setup.defaultRules ?? []) {
    if (r["Default Value"] === from) r["Default Value"] = to;
    if (r["Trigger Answer"] === from) r["Trigger Answer"] = to;
  }
  for (const r of setup.rules) {
    if (r["Trigger Answer"] === from) r["Trigger Answer"] = to;
    if (r["Target Answer"] === from) r["Target Answer"] = to;
  }
  for (const t of [...setup.templates, ...(setup.referenceRules ?? [])]) {
    if (t["Condition Values"]) t["Condition Values"] = swapIn(t["Condition Values"], from, to);
    if (t["And Condition Values"]) t["And Condition Values"] = swapIn(t["And Condition Values"], from, to);
  }
  for (const st of setup.signTypes) {
    if (st["Selected When"]) st["Selected When"] = st["Selected When"].split(";").map((p) => { const i = p.indexOf("="); return i < 0 ? p : p.slice(0, i + 1) + swapIn(p.slice(i + 1).trim(), from, to); }).join(";");
  }
  if (n) log(`renamed "${from}" → "${to}"${itemNo ? ` (#${itemNo})` : ""} on ${n} answers`);
}
function removeAnswer(value) {
  const before = setup.options.length;
  setup.options = setup.options.filter((o) => o.Value !== value);
  const rules = setup.rules.length;
  setup.rules = setup.rules.filter((r) => r["Trigger Answer"] !== value && r["Target Answer"] !== value);
  setup.defaultRules = (setup.defaultRules ?? []).filter((r) => r["Default Value"] !== value && r["Trigger Answer"] !== value);
  for (const q of setup.questions) if (q["Default Value"] === value) q["Default Value"] = "";
  if (before !== setup.options.length) log(`removed "${value}" (${before - setup.options.length} answers, ${rules - setup.rules.length} rules)`);
}
renameAnswer("1”x1”x.187” Aluminum Angle", "1”x1”x.125” Aluminum Angle", "20005");
renameAnswer("3”x3”x.187” Aluminum Angle", "3”x3”x.125” Aluminum Angle", "20059");
renameAnswer("2”x1”x.187” Aluminum Angle", "2”x1.5”x.125” Aluminum Angle", "20030");
removeAnswer(".375” Matte Clear Plex"); // not stocked
// Alex's picks (Oct 15).
const PICKED = {
  "2” Sq Tube Aluminum": "25035", // 2 x .125 ArchAl Sq Tube
  "2”x2”x.187” Aluminum Angle": "20050", // his own example: … Aluminum Angle (#20050)
};
for (const o of setup.options) if (PICKED[o.Value] && !o["Item No."]) o["Item No."] = PICKED[o.Value];

// --- Round 3 (Alex, Oct 15): link materials to BC items ------------------------
// Optional 3rd argument: items.csv from scripts/bc-items-probe.ps1. Adds the
// item snapshot (sign material categories only) and links every answer whose
// best item is clear (high / medium). "Pick" answers (several equally good —
// sheet sizes, angle wall thickness) are left for Setup → Materials & Items.
if (itemsCsv) {
  const { readItemsCsv } = await import("./items-csv.mjs");
  const { SIGN_ITEM_CATEGORIES, describeItems, matchConfidence, suggestItems } = await import("../src/setup/item-match.ts");
  const items = readItemsCsv(readFileSync(itemsCsv, "utf8")).filter((i) => SIGN_ITEM_CATEGORIES.includes(i.category));
  setup.items = items.map((i) => ({ "No.": i.no, Description: i.name, "Item Category Code": i.category, "Base Unit of Measure": i.uom }));
  log(`items: ${items.length} BC items in ${SIGN_ITEM_CATEGORIES.length} sign material categories`);
  const described = describeItems(items);
  const cache = new Map();
  let linked = 0;
  let toPick = 0;
  for (const o of setup.options) {
    if (o["Item No."]) continue;
    const v = String(o.Value);
    if (!cache.has(v)) {
      const s = suggestItems(v, items, described);
      cache.set(v, { s, c: matchConfidence(s) });
    }
    const { s, c } = cache.get(v);
    if (c === "high" || c === "medium") {
      o["Item No."] = s[0].item.no;
      linked++;
    } else if (c === "pick") toPick++;
  }
  log(`answers linked to an item: ${linked} (${toPick} answers have several equally good items — pick in Setup → Materials & Items)`);
  let vinylLinked = 0;
  for (const c of setup.vinylColors ?? []) {
    if (c["Item No."]) continue;
    const code = String(c.Code).startsWith(`${c.Series}-`) ? c.Code : `${c.Series}-${c.Code}`;
    const s = suggestItems(`${code} ${c.Name} vinyl`, items, described);
    if (s.length) {
      c["Item No."] = s[0].item.no;
      vinylLinked++;
    }
  }
  log(`vinyl colors linked: ${vinylLinked} of ${(setup.vinylColors ?? []).length}`);
}

setup.fixesApplied = "fix-bc-setup-export.mjs (Oct 15, 2026, round 3)";
writeFileSync(output, JSON.stringify(setup));
console.log(`Wrote ${output}`);
