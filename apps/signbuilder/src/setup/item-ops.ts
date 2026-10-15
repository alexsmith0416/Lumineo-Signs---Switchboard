// Setup edits for BC item links. Each returns a NEW SetupData.
import type { BcItem, SetupData } from "../domain/types";
import { describeMaterial, type MaterialFamily } from "./item-match";

/** Link (or unlink with "") every answer with this exact wording, on every
 *  sign type, to one BC item — the same material is the same part. */
export function setItemForValue(setup: SetupData, value: string, itemNo: string): SetupData {
  return {
    ...setup,
    options: setup.options.map((o) => (o.value === value ? { ...o, itemNo: itemNo || undefined } : o)),
  };
}

export function setVinylItem(setup: SetupData, series: string, code: string, itemNo: string): SetupData {
  return {
    ...setup,
    vinylColors: setup.vinylColors.map((c) => (c.series === series && c.code === code ? { ...c, itemNo: itemNo || undefined } : c)),
  };
}

export function setShowPartNumbers(setup: SetupData, on: boolean): SetupData {
  return { ...setup, settings: { ...setup.settings, showPartNumbers: on } };
}

/** Adds an answer (linked to the item) to each question, at the end of its list. */
export function addItemAnswer(setup: SetupData, targets: { signTypeCode: string; questionCode: string }[], value: string, itemNo: string): SetupData {
  const options = [...setup.options];
  for (const t of targets) {
    const mine = options.filter((o) => o.signTypeCode === t.signTypeCode && o.questionCode === t.questionCode);
    if (mine.some((o) => o.value.toLowerCase() === value.toLowerCase())) continue;
    const sortOrder = mine.reduce((m, o) => Math.max(m, o.sortOrder), 0) + 10;
    options.push({ signTypeCode: t.signTypeCode, questionCode: t.questionCode, value, sortOrder, hint: "", alsoMatches: "", codeSegment: "", outputText: "", productionFormat: "", itemNo });
  }
  return { ...setup, options };
}

/** The questions whose answers are this kind of material (where a new item of
 *  that kind belongs). */
export function questionsForFamily(setup: SetupData, family: MaterialFamily): { signTypeCode: string; questionCode: string; prompt: string; typeName: string }[] {
  if (!family) return [];
  const keys = new Set<string>();
  for (const o of setup.options) {
    if (describeMaterial(o.value).family === family) keys.add(`${o.signTypeCode}\u0001${o.questionCode}`);
  }
  return [...keys]
    .map((k) => {
      const [signTypeCode, questionCode] = k.split("\u0001") as [string, string];
      const q = setup.questions.find((x) => x.signTypeCode === signTypeCode && x.code === questionCode);
      const t = setup.signTypes.find((x) => x.code === signTypeCode);
      return { signTypeCode, questionCode, prompt: q?.prompt ?? questionCode, typeName: t?.description ?? signTypeCode, active: t?.active ?? false };
    })
    .filter((x) => x.active)
    .sort((a, b) => a.typeName.localeCompare(b.typeName) || a.prompt.localeCompare(b.prompt));
}

const dec = (n: number) => {
  const s = String(Math.round(n * 1000) / 1000);
  return s.startsWith("0.") ? s.slice(1) : s;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** An answer's wording for a BC item, in the house style of the existing
 *  answers ("2”x2”x.187” Aluminum Angle", ".177” White Plex", "3mm ACM") —
 *  cleaner than BC's own item names. Editable before it's added. */
export function cleanWording(item: BcItem): string {
  const m = describeMaterial(item.name, item.category);
  const color = m.colors.filter((c) => c !== "milky").map(cap).join(" ");
  const section = m.dims.map((d) => `${dec(d)}”`).join("x");
  switch (m.family) {
    case "al-angle":
      return `${section} Aluminum Angle`;
    case "steel-angle":
      return `${m.dims.map((d) => `${dec(d)}”`).join(" x ")} Angle Iron`;
    case "al-tube":
    case "steel-tube": {
      const square = m.dims.length >= 2 && m.dims[0] === m.dims[1];
      return `${section} ${m.family === "al-tube" ? "Aluminum " : "Steel "}${square ? "Square" : "Rectangle"} Tube`;
    }
    case "al-sheet":
      if (m.thick === null) return item.name;
      return `${dec(m.thick)}${color ? ` ${color}` : ""} Aluminum${m.tags.includes("5052") ? " 5052" : ""}`;
    case "plex":
      if (m.thick === null) return item.name;
      return `${dec(m.thick)}”${color ? ` ${color}` : ""} Plex`;
    case "poly":
      if (m.thick === null) return item.name;
      return `${dec(m.thick)}”${color ? ` ${color}` : ""} Polycarbonate`;
    case "acm":
      return m.mm ? `${dec(m.mm)}mm ACM` : item.name;
    default:
      return item.name;
  }
}
