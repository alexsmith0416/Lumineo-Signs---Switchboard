// Setup edits on categories (Channel Letters, Monument…). Each returns a NEW
// SetupData. Codes don't change once made: signs already spec'd keep their
// category code.
import type { Category, SetupData } from "../domain/types";
import { duplicateSignType, signTypeCodeError } from "./sign-type-ops";

export type CategoryPatch = Partial<Omit<Category, "code">>;

const sorted = (setup: SetupData) => [...setup.categories].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

export function updateCategory(setup: SetupData, code: string, patch: CategoryPatch): SetupData {
  return { ...setup, categories: setup.categories.map((c) => (c.code === code ? { ...c, ...patch } : c)) };
}

/** Category codes: what BC allowed (Code[20], upper case). */
export function categoryCodeError(setup: SetupData, code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return "Enter a code.";
  if (c.length > 20) return "Codes are at most 20 characters.";
  if (!/^[A-Z0-9][A-Z0-9/_.-]*$/.test(c)) return "Use letters, digits and - / _ . only.";
  if (setup.categories.some((x) => x.code === c)) return `${c} already exists.`;
  return "";
}

/** Other categories with the same Spec Code prefix (their codes would look alike). */
export function prefixClashes(setup: SetupData, code: string, prefix: string): Category[] {
  const p = prefix.trim().toUpperCase();
  return p ? setup.categories.filter((c) => c.code !== code && c.codePrefix.trim().toUpperCase() === p) : [];
}

/** Adds a category at the end, inactive until it has a sign type. */
export function addCategory(setup: SetupData, code: string, description: string, codePrefix: string): SetupData {
  const c = code.trim().toUpperCase();
  const err = categoryCodeError(setup, c);
  if (err) throw new Error(err);
  const sortOrder = setup.categories.reduce((m, x) => Math.max(m, x.sortOrder), 0) + 10;
  return {
    ...setup,
    categories: [...setup.categories, { code: c, description: description.trim() || c, codePrefix: codePrefix.trim().toUpperCase(), sortOrder, active: false }],
  };
}

/** Swaps the category with the one above (-1) or below (+1); sort orders become 10, 20, 30… */
export function moveCategory(setup: SetupData, code: string, dir: -1 | 1): SetupData {
  const list = sorted(setup);
  const i = list.findIndex((c) => c.code === code);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return setup;
  [list[i], list[j]] = [list[j]!, list[i]!];
  const order = new Map(list.map((c, n) => [c.code, (n + 1) * 10]));
  return { ...setup, categories: setup.categories.map((c) => ({ ...c, sortOrder: order.get(c.code)! })) };
}

/** Why the category can't be deleted ("" = it can). Sign types (blocks too) must be moved or deleted first. */
export function deleteCategoryBlocker(setup: SetupData, code: string): string {
  const n = setup.signTypes.filter((t) => t.categoryCode === code).length;
  return n ? `It has ${n} sign type${n === 1 ? "" : "s"} — move them to another category (Sign Types tab) or deactivate the category instead.` : "";
}

/** Deletes an empty category with its stage checklist lines. */
export function deleteCategory(setup: SetupData, code: string): SetupData {
  const blocker = deleteCategoryBlocker(setup, code);
  if (blocker) throw new Error(blocker);
  return {
    ...setup,
    categories: setup.categories.filter((c) => c.code !== code),
    checklist: setup.checklist.filter((l) => l.categoryCode !== code),
  };
}

/** A new sign type in the category, copied from any existing one (questions,
 *  answers, rules, descriptions…). Inactive with no Selected When, like Duplicate. */
export function newTypeInCategory(setup: SetupData, categoryCode: string, fromType: string, code: string, description: string): SetupData {
  const err = signTypeCodeError(setup, code);
  if (err) throw new Error(err);
  const c = code.trim().toUpperCase();
  const s = duplicateSignType(setup, fromType, c, description);
  const sortOrder = s.signTypes.filter((t) => t.categoryCode === categoryCode && t.code !== c).reduce((m, t) => Math.max(m, t.sortOrder), 0) + 10;
  return { ...s, signTypes: s.signTypes.map((t) => (t.code === c ? { ...t, categoryCode, sortOrder } : t)) };
}
