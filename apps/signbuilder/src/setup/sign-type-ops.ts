// Setup edits on sign types. Each returns a NEW SetupData (the store saves the
// documents that changed), never mutating the one on screen.
import type { SetupData, SignType } from "../domain/types";

export type SignTypePatch = Partial<Omit<SignType, "code" | "isBlock">>;

export function updateSignType(setup: SetupData, code: string, patch: SignTypePatch): SetupData {
  return { ...setup, signTypes: setup.signTypes.map((t) => (t.code === code ? { ...t, ...patch } : t)) };
}

/** Sign type codes: what BC allowed (Code[20], upper case). */
export function signTypeCodeError(setup: SetupData, code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return "Enter a code.";
  if (c.length > 20) return "Codes are at most 20 characters.";
  if (!/^[A-Z0-9][A-Z0-9/_.-]*$/.test(c)) return "Use letters, digits and - / _ . only.";
  if (setup.signTypes.some((t) => t.code === c)) return `${c} already exists.`;
  return "";
}

/** A copy of a sign type with everything under it — questions, answers, Spec
 *  Rules, Field Description lines, reference rules and blocks used. The copy
 *  starts inactive with a blank Selected When, so it can't be picked until
 *  it's set up. */
export function duplicateSignType(setup: SetupData, fromCode: string, newCode: string, description: string): SetupData {
  const code = newCode.trim().toUpperCase();
  const from = setup.signTypes.find((t) => t.code === fromCode);
  if (!from) throw new Error(`Sign type ${fromCode} not found.`);
  const err = signTypeCodeError(setup, code);
  if (err) throw new Error(err);
  const mine = <T extends { signTypeCode: string }>(list: T[]) => list.filter((x) => x.signTypeCode === fromCode).map((x) => ({ ...x, signTypeCode: code }));
  return {
    ...setup,
    signTypes: [
      ...setup.signTypes,
      { ...from, code, description: description.trim() || `${from.description} (copy)`, active: false, selectedWhen: "", sortOrder: from.sortOrder + 1 },
    ],
    questions: [...setup.questions, ...mine(setup.questions)],
    options: [...setup.options, ...mine(setup.options)],
    rules: [...setup.rules, ...mine(setup.rules).map((r) => ({ ...r, id: crypto.randomUUID() }))],
    templates: [...setup.templates, ...mine(setup.templates)],
    referenceRules: [...setup.referenceRules, ...mine(setup.referenceRules)],
    blockUsages: [...setup.blockUsages, ...mine(setup.blockUsages)],
    defaultRules: [...setup.defaultRules, ...mine(setup.defaultRules).map((r) => ({ ...r, id: crypto.randomUUID() }))],
  };
}
