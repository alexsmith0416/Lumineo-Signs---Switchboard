// Setup edits on Spec Reference pages, the rules that pick a sign type's page,
// vinyl colors and the stage checklist. Each returns a NEW SetupData.
import type { ChecklistLine, ReferenceRule, SetupData, SpecReference, VinylColor } from "../domain/types";

const STEP = 10000;

// ---- Reference pages ----------------------------------------------------------

export function referenceCodeError(setup: SetupData, code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return "Enter a code.";
  if (c.length > 20) return "Codes are at most 20 characters.";
  if (!/^[A-Z0-9][A-Z0-9/_.-]*$/.test(c)) return "Use letters, digits and - / _ . only.";
  if (setup.references.some((r) => r.code === c)) return `${c} already exists.`;
  return "";
}

/** Sign types whose rules show the page. */
export function typesUsingReference(setup: SetupData, code: string): string[] {
  return [...new Set(setup.referenceRules.filter((r) => r.referenceCode === code).map((r) => r.signTypeCode))].sort();
}

/** The setup with one reference page added or changed (images aren't kept in the setup). */
export function putReference(setup: SetupData, ref: SpecReference): SetupData {
  const meta: SpecReference = { code: ref.code, description: ref.description, fileName: ref.fileName, sharePointUrl: ref.sharePointUrl };
  const i = setup.references.findIndex((r) => r.code === ref.code);
  const references = i >= 0 ? setup.references.map((r, n) => (n === i ? { ...r, ...meta } : r)) : [...setup.references, meta];
  return { ...setup, references };
}

export function removeReference(setup: SetupData, code: string): SetupData {
  return { ...setup, references: setup.references.filter((r) => r.code !== code), referenceRules: setup.referenceRules.filter((r) => r.referenceCode !== code) };
}

// ---- Reference rules (which page a sign type shows; the first that matches wins) ---

export const rulesOf = (setup: SetupData, type: string) => setup.referenceRules.filter((r) => r.signTypeCode === type).sort((a, b) => a.lineNo - b.lineNo);

export type ReferenceRulePatch = Partial<Omit<ReferenceRule, "signTypeCode" | "lineNo">>;

export function updateReferenceRule(setup: SetupData, type: string, lineNo: number, patch: ReferenceRulePatch): SetupData {
  return { ...setup, referenceRules: setup.referenceRules.map((r) => (r.signTypeCode === type && r.lineNo === lineNo ? { ...r, ...patch } : r)) };
}

export function addReferenceRule(setup: SetupData, type: string, referenceCode: string): SetupData {
  const lineNo = (rulesOf(setup, type).at(-1)?.lineNo ?? 0) + STEP;
  const rule: ReferenceRule = { signTypeCode: type, lineNo, referenceCode, conditionQuestion: "", conditionValues: "", andConditionQuestion: "", andConditionValues: "" };
  return { ...setup, referenceRules: [...setup.referenceRules, rule] };
}

export function deleteReferenceRule(setup: SetupData, type: string, lineNo: number): SetupData {
  return { ...setup, referenceRules: setup.referenceRules.filter((r) => !(r.signTypeCode === type && r.lineNo === lineNo)) };
}

export function moveReferenceRule(setup: SetupData, type: string, lineNo: number, dir: -1 | 1): SetupData {
  const list = rulesOf(setup, type);
  const i = list.findIndex((r) => r.lineNo === lineNo);
  const other = list[i + dir];
  if (i < 0 || !other) return setup;
  return {
    ...setup,
    referenceRules: setup.referenceRules.map((r) =>
      r.signTypeCode !== type ? r : r.lineNo === lineNo ? { ...r, lineNo: other.lineNo } : r.lineNo === other.lineNo ? { ...r, lineNo } : r,
    ),
  };
}

// ---- Vinyl colors ---------------------------------------------------------------

export const colorKey = (c: Pick<VinylColor, "series" | "code">) => `${c.series}|${c.code}`;

export function vinylCodeError(setup: SetupData, series: string, code: string): string {
  if (!series.trim()) return "Enter the series (e.g. 3630).";
  if (!code.trim()) return "Enter the color code (e.g. 3630-20).";
  if (setup.vinylColors.some((c) => c.series === series.trim() && c.code.toLowerCase() === code.trim().toLowerCase())) return `${code.trim()} is already in ${series.trim()}.`;
  return "";
}

export function updateVinylColor(setup: SetupData, key: string, patch: Partial<Omit<VinylColor, "series" | "code">>): SetupData {
  return { ...setup, vinylColors: setup.vinylColors.map((c) => (colorKey(c) === key ? { ...c, ...patch } : c)) };
}

export function addVinylColor(setup: SetupData, color: Pick<VinylColor, "series" | "code" | "name">): SetupData {
  const series = color.series.trim();
  const err = vinylCodeError(setup, series, color.code);
  if (err) throw new Error(err);
  const sortOrder = setup.vinylColors.filter((c) => c.series === series).reduce((m, c) => Math.max(m, c.sortOrder), 0) + 10;
  const c: VinylColor = { series, code: color.code.trim(), name: color.name.trim(), pantoneRef: "", family: "", notes: "", hex: "", sortOrder };
  return { ...setup, vinylColors: [...setup.vinylColors, c] };
}

export function deleteVinylColor(setup: SetupData, key: string): SetupData {
  return { ...setup, vinylColors: setup.vinylColors.filter((c) => colorKey(c) !== key) };
}

// ---- Stage checklist ----------------------------------------------------------------

/** "ALL" lines apply to every category. */
export const ALL_CATEGORIES = "ALL";

export const checklistOf = (setup: SetupData, category: string) => setup.checklist.filter((l) => l.categoryCode === category).sort((a, b) => a.lineNo - b.lineNo);

export function updateChecklistLine(setup: SetupData, lineNo: number, patch: Partial<Omit<ChecklistLine, "lineNo">>): SetupData {
  return { ...setup, checklist: setup.checklist.map((l) => (l.lineNo === lineNo ? { ...l, ...patch } : l)) };
}

export function addChecklistLine(setup: SetupData, category: string, group: string): { setup: SetupData; lineNo: number } {
  const lineNo = setup.checklist.reduce((m, l) => Math.max(m, l.lineNo), 0) + STEP;
  const line: ChecklistLine = { lineNo, categoryCode: category, group, detail: "", inForm: "", stage: "job", notes: "", questionCodes: "" };
  return { setup: { ...setup, checklist: [...setup.checklist, line] }, lineNo };
}

export function deleteChecklistLine(setup: SetupData, lineNo: number): SetupData {
  return { ...setup, checklist: setup.checklist.filter((l) => l.lineNo !== lineNo) };
}

/** Swaps the line with the one above / below within its category. */
export function moveChecklistLine(setup: SetupData, lineNo: number, dir: -1 | 1): SetupData {
  const line = setup.checklist.find((l) => l.lineNo === lineNo);
  if (!line) return setup;
  const list = checklistOf(setup, line.categoryCode);
  const other = list[list.findIndex((l) => l.lineNo === lineNo) + dir];
  if (!other) return setup;
  return { ...setup, checklist: setup.checklist.map((l) => (l.lineNo === lineNo ? { ...l, lineNo: other.lineNo } : l.lineNo === other.lineNo ? { ...l, lineNo } : l)) };
}
