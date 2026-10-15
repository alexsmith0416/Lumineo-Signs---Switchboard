// Matching Sign Builder answers to BC items (Item table 27). No imports, so the
// Node scripts can load it directly (node ≥ 23 strips the types).
//
// Reads sizes the way answers and BC write them: 2”x2”x.187” ≡ 2x2x.187 ≡
// 2 X 2 X .187, 1-1/2” ≡ 1.5, 3/4 ≡ .75. Abbreviations: Alum/Alm/Al ≡ Aluminum,
// Ang ≡ Angle, Wh/Wht ≡ White, Clr ≡ Clear, Poly/Polycarb ≡ Polycarbonate.
// The item's BC category decides what it is (steel vs aluminum, sheet vs angle).

export interface ItemLike {
  no: string;
  name: string;
  category: string;
}

export type MaterialFamily =
  | ""
  | "al-angle"
  | "al-sheet"
  | "al-tube"
  | "al-extrusion"
  | "steel-angle"
  | "steel-tube"
  | "steel-pipe"
  | "steel-sheet"
  | "plex"
  | "poly"
  | "acm"
  | "vinyl";

/** BC item category → what kind of material it holds. */
export const CATEGORY_FAMILY: Record<string, MaterialFamily> = {
  ALUANG: "al-angle",
  ALUSHT: "al-sheet",
  ALUTUB: "al-tube",
  ALUEXT: "al-extrusion",
  ALUSHP: "al-extrusion",
  ALUBAR: "al-extrusion",
  STLSHP: "steel-angle",
  STLTUB: "steel-tube",
  STLPIP: "steel-pipe",
  STLSHT: "steel-sheet",
  PLASSH: "plex",
  POLYSH: "poly",
  GRASUB: "acm",
  VOPAQU: "vinyl",
  VTRANS: "vinyl",
  VSPECL: "vinyl",
  VREFLC: "vinyl",
};

/** The BC item categories Sign Builder links to (Alex: "only certain item
 *  categories"). Adjust here; the item snapshot is filtered to these. */
export const SIGN_ITEM_CATEGORIES = [
  ...Object.keys(CATEGORY_FAMILY),
  "PLAMIS",
  "DIGITAL",
  "ELLED",
  "FLEX",
  "EXTSIGN",
  "INTSGN",
  "CCMAT",
];

export interface Material {
  raw: string;
  family: MaterialFamily;
  /** Cross-section for angle / tube: legs (and wall thickness when given). */
  dims: number[];
  /** Sheet thickness in inches (.090, .177…). */
  thick: number | null;
  mm: number | null;
  colors: string[];
  tags: string[];
}

const num = (s: string): number => {
  const t = s.trim();
  let m = t.match(/^(\d+)-(\d+)\/(\d+)$/);
  if (m) return +m[1]! + +m[2]! / +m[3]!;
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return +m[1]! / +m[2]!;
  return parseFloat(t);
};

const NUM = "(\\d+-\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+)";
const DIM_RE = new RegExp(`${NUM}\\s*x\\s*${NUM}(?:\\s*x\\s*${NUM})?`);

export function describeMaterial(text: string, category = ""): Material {
  const t = ` ${text} `
    .toLowerCase()
    .replace(/[”″“"]/g, '"')
    .replace(/[’′]/g, "'")
    .replace(/(\d)\s*"/g, "$1 ")
    .replace(/\s+/g, " ");
  const has = (re: RegExp) => re.test(t);
  const d: Material = { raw: text, family: "", dims: [], thick: null, mm: null, colors: [], tags: [] };

  const dm = t.match(DIM_RE);
  if (dm) d.dims = [dm[1], dm[2], dm[3]].filter((x): x is string => !!x).map(num);
  const mm = t.match(/(\d+(?:\.\d+)?)\s*mm\b/);
  if (mm) d.mm = +mm[1]!;
  // Sheet thickness: a leading decimal like .090 / .177 (not a sheet size "4 x 8").
  const th = t.match(/\s(\.\d{2,3})(?=[\s/"]|mil)/);
  if (th) d.thick = +th[1]!;
  else if (!dm) {
    const frac = t.match(/\s(\d+\/\d+)\s/); // 1/2” Aluminum
    if (frac) d.thick = num(frac[1]!);
  }

  const fromCategory = CATEGORY_FAMILY[category.toUpperCase()];
  // GRASUB (Graphics Substrates) also holds Sintra, plywood… — only ACM is "acm".
  if (fromCategory === "acm") d.family = has(/\bacm\b|dibond|alupanel|omegabond/) ? "acm" : "";
  else if (fromCategory) d.family = fromCategory;
  else if (has(/vinyl|\b(3630|3635|7725|680|8500)-\d+/)) d.family = "vinyl";
  else if (has(/\bacm\b|dibond|alupanel|omegabond/)) d.family = "acm";
  else if (has(/angle iron|\b(stl|steel)\b.*\bang/)) d.family = "steel-angle";
  else if (has(/\bang(le)?\b/)) d.family = "al-angle";
  else if (has(/\btubes?\b|\btub\b/)) d.family = has(/\b(stl|steel)\b/) ? "steel-tube" : "al-tube";
  else if (has(/polycarb|\bpoly\b|lexan/)) d.family = "poly";
  else if (has(/\bplex\b|acrylic/)) d.family = "plex";
  else if (has(/\balum|\balm\b|\bal\b|aluminum/) && (d.thick !== null || has(/\bmil\b/))) d.family = "al-sheet";
  if (d.family === "al-sheet" || d.family === "plex" || d.family === "poly") d.dims = []; // "4 x 8" is a sheet size

  if (d.family === "vinyl") {
    const code = t.match(/\b(3630|3635|7725|680|8500|7125)-(\d+)/);
    if (code) d.tags.push(`${code[1]}-${code[2]}`);
  }
  const colorRes: [string, RegExp][] = [
    ["white", /\bwh(ite|t)?\b/],
    ["clear", /\bclr\b|\bclear\b/],
    ["black", /\bblack\b|\bblk\b/],
    ["bronze", /\bbronze\b/],
    ["matte", /\bmatte\b/],
    ["milky", /\bmilky\b/],
    ["color", /\bcolou?r(ed)?\b/],
    ["red", /\bred\b/],
  ];
  for (const [c, re] of colorRes) if (re.test(t)) d.colors.push(c);
  if (has(/pre-?painted/)) d.tags.push("prepainted");
  if (has(/\b5052\b/)) d.tags.push("5052");
  if (has(/\b3003\b/)) d.tags.push("3003");
  if (has(/rout/)) d.tags.push("routing");
  if (has(/perf/)) d.tags.push("perf");
  if (has(/\bsq(uare)?\b/)) d.tags.push("square");
  return d;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.001;
function sameSection(a: number[], b: number[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  const legs = (near(a[0]!, b[0]!) && near(a[1]!, b[1]!)) || (near(a[0]!, b[1]!) && near(a[1]!, b[0]!));
  if (!legs) return false;
  if (a[2] === undefined) return true; // the answer doesn't give the wall thickness
  return b[2] !== undefined && near(a[2], b[2]);
}

/** 0 = not this item; higher = better. */
export function scoreItem(answer: Material, item: Material): number {
  if (!answer.family || answer.family !== item.family) return 0;
  let s = 10;
  if (answer.family === "vinyl") {
    const code = answer.tags.find((x) => /-\d+$/.test(x));
    if (!code || !item.tags.includes(code)) return 0;
    return /^\s*48\b/.test(item.raw.replace(/["”]/g, " ")) ? 30 : 20; // the 48" roll unless told otherwise
  }
  if (["al-angle", "steel-angle", "al-tube", "steel-tube"].includes(answer.family)) {
    if (!sameSection(answer.dims, item.dims)) return 0;
    s += answer.dims.length === 3 ? 10 : 2;
  } else if (answer.family === "acm") {
    if (answer.mm && item.mm && !near(answer.mm, item.mm)) return 0;
    if (answer.mm && item.mm) s += 8;
  } else {
    if (answer.thick === null || item.thick === null || !near(answer.thick, item.thick)) return 0;
    s += 8;
  }
  for (const c of answer.colors) {
    if (item.colors.includes(c)) s += 4;
    else return 0;
  }
  // A plain answer means plain stock: not milky / colored / perforated / routing blanks.
  for (const c of item.colors) if (!answer.colors.includes(c) && c !== "clear") s -= 3;
  for (const tag of ["prepainted", "5052", "3003", "square"]) if (answer.tags.includes(tag) && item.tags.includes(tag)) s += 2;
  if (item.tags.includes("perf") && !answer.tags.includes("perf")) s -= 6;
  if (item.tags.includes("routing") && !answer.tags.includes("routing") && !answer.tags.includes("5052")) s -= 2;
  return s;
}

export interface ItemSuggestion<T extends ItemLike> {
  item: T;
  score: number;
}

/** The items that fit an answer, best first. "Several equally good" =
 *  the first two have the same score. */
export function suggestItems<T extends ItemLike>(answer: string, items: T[], described?: Map<string, Material>): ItemSuggestion<T>[] {
  const a = describeMaterial(answer);
  if (!a.family) return [];
  const out: ItemSuggestion<T>[] = [];
  for (const it of items) {
    const m = described?.get(it.no) ?? describeMaterial(it.name, it.category);
    const s = scoreItem(a, m);
    if (s > 0) out.push({ item: it, score: s });
  }
  return out.sort((x, y) => y.score - x.score || x.item.no.localeCompare(y.item.no));
}

export function describeItems<T extends ItemLike>(items: T[]): Map<string, Material> {
  return new Map(items.map((i) => [i.no, describeMaterial(i.name, i.category)]));
}

export type MatchConfidence = "high" | "medium" | "pick" | "none";

/** high = one clear item with every detail matching; medium = one best item
 *  (the answer leaves something out, e.g. the alloy); pick = several equally
 *  good (sheet sizes, or an angle without its wall thickness); none. */
export function matchConfidence(s: ItemSuggestion<ItemLike>[]): MatchConfidence {
  if (s.length === 0) return "none";
  if (s.length > 1 && s[1]!.score === s[0]!.score) return "pick";
  return s[0]!.score >= 20 ? "high" : "medium";
}
