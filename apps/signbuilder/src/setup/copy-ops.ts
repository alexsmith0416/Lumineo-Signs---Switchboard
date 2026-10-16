// Re-using questions between sign types (a port of BC's LSB Setup Copy Mgt.):
// copy questions — with their answers, the rules that show them / limit their
// answers, and their defaults — to other sign types, optionally with the
// follow-up questions they open; and keep a category's type-picking questions
// the same on every type. Each returns a NEW SetupData.
import type { Question, SetupData } from "../domain/types";

const sameRule = (a: { triggerQuestion: string; triggerAnswer: string; targetQuestion: string }, b: typeof a) =>
  a.triggerQuestion === b.triggerQuestion && a.targetQuestion === b.targetQuestion && a.triggerAnswer.trim().toLowerCase() === b.triggerAnswer.trim().toLowerCase();

/** The listed questions plus every question a listed one brings up (a rule or
 *  Also requires), until no more are found. Returned in question order. */
export function withFollowUps(setup: SetupData, type: string, codes: string[]): string[] {
  const list = new Set(codes);
  const mine = setup.questions.filter((q) => q.signTypeCode === type);
  const rules = setup.rules.filter((r) => r.signTypeCode === type && r.targetAnswer === "");
  for (let added = true; added; ) {
    added = false;
    for (const q of mine) {
      if (list.has(q.code)) continue;
      const shownByListed = q.scope === "conditional" && rules.some((r) => r.targetQuestion === q.code && list.has(r.triggerQuestion));
      if (shownByListed || (q.alsoRequiresQuestion && list.has(q.alsoRequiresQuestion))) {
        list.add(q.code);
        added = true;
      }
    }
  }
  return mine.filter((q) => list.has(q.code)).sort((a, b) => a.sortOrder - b.sortOrder).map((q) => q.code);
}

export interface PasteResult {
  setup: SetupData;
  /** Per target type: pasted / kept (already there, not replaced). */
  pasted: number;
  kept: number;
  /** "TYPE: CODE" for pasted questions that depend on a question the target doesn't have. */
  missingParents: string[];
}

/** Questions of `fromType` that already exist on each target. */
export function existingOn(setup: SetupData, codes: string[], targets: string[]): { type: string; codes: string[] }[] {
  return targets
    .map((type) => ({ type, codes: codes.filter((c) => setup.questions.some((q) => q.signTypeCode === type && q.code === c)) }))
    .filter((x) => x.codes.length > 0);
}

/** Copies the questions to each target type. Questions a target already has
 *  are replaced when `replace`, else left as they are. */
export function pasteQuestions(setup: SetupData, fromType: string, codes: string[], targets: string[], replace: boolean): PasteResult {
  let s = setup;
  let pasted = 0;
  let kept = 0;
  const missing: string[] = [];
  const sources = setup.questions.filter((q) => q.signTypeCode === fromType && codes.includes(q.code));
  for (const to of targets.filter((t) => t !== fromType)) {
    const usesBlock = (b: string) => s.blockUsages.some((u) => u.signTypeCode === to && u.blockCode === b);
    const here = (code: string) => s.questions.some((q) => q.signTypeCode === to && q.code === code);
    const take = sources.filter((q) => {
      if (!here(q.code)) return true;
      if (replace) return true;
      kept++;
      return false;
    });
    if (take.length === 0) continue;
    const codesTaken = new Set(take.map((q) => q.code));
    const onTo = <T extends { signTypeCode: string }>(x: T) => x.signTypeCode === to;
    // Replaced questions go first, with their answers and the rules about them.
    s = {
      ...s,
      questions: s.questions.filter((q) => !(onTo(q) && codesTaken.has(q.code))),
      options: s.options.filter((o) => !(onTo(o) && codesTaken.has(o.questionCode))),
      rules: s.rules.filter((r) => !(onTo(r) && codesTaken.has(r.targetQuestion))),
      defaultRules: s.defaultRules.filter((r) => !(onTo(r) && codesTaken.has(r.targetQuestion))),
    };
    const fromRules = setup.rules.filter((r) => r.signTypeCode === fromType && codesTaken.has(r.targetQuestion));
    const fromDefaults = setup.defaultRules.filter((r) => r.signTypeCode === fromType && codesTaken.has(r.targetQuestion));
    const newRules = fromRules
      .filter((r) => !s.rules.some((x) => onTo(x) && x.targetAnswer === r.targetAnswer && sameRule(x, r)))
      .map((r) => ({ ...r, id: crypto.randomUUID(), signTypeCode: to }));
    s = {
      ...s,
      questions: [...s.questions, ...take.map((q): Question => ({ ...q, signTypeCode: to, blockCode: q.blockCode && usesBlock(q.blockCode) ? q.blockCode : "" }))],
      options: [...s.options, ...setup.options.filter((o) => o.signTypeCode === fromType && codesTaken.has(o.questionCode)).map((o) => ({ ...o, signTypeCode: to }))],
      rules: [...s.rules, ...newRules],
      defaultRules: [...s.defaultRules, ...fromDefaults.map((r) => ({ ...r, id: crypto.randomUUID(), signTypeCode: to }))],
    };
    pasted += take.length;
    for (const q of take) {
      const parents = [
        ...fromRules.filter((r) => r.targetQuestion === q.code && r.targetAnswer === "").map((r) => r.triggerQuestion),
        ...(q.alsoRequiresQuestion ? [q.alsoRequiresQuestion] : []),
      ];
      const has = (c: string) => s.questions.some((x) => x.signTypeCode === to && x.code === c);
      if (parents.length && !parents.some(has)) missing.push(`${to}: ${q.code}`);
      else if (q.alsoRequiresQuestion && !has(q.alsoRequiresQuestion)) missing.push(`${to}: ${q.code}`);
    }
  }
  return { setup: s, pasted, kept, missingParents: missing };
}

/** The type-picking questions of `fromType` copied to every other type of its
 *  category, replacing theirs (and removing picking questions it doesn't have). */
export function sharePickingQuestions(setup: SetupData, fromType: string): { setup: SetupData; types: number } {
  const t = setup.signTypes.find((x) => x.code === fromType);
  if (!t) return { setup, types: 0 };
  const others = setup.signTypes.filter((x) => x.categoryCode === t.categoryCode && x.code !== fromType && !x.isBlock).map((x) => x.code);
  const picking = setup.questions.filter((q) => q.signTypeCode === fromType && q.picksSignType).map((q) => q.code);
  let s = setup;
  // Picking questions the source doesn't have are removed from the others.
  for (const o of others) {
    const extra = s.questions.filter((q) => q.signTypeCode === o && q.picksSignType && !picking.includes(q.code)).map((q) => q.code);
    if (extra.length === 0) continue;
    const gone = (x: { signTypeCode: string }, code: string) => x.signTypeCode === o && extra.includes(code);
    s = {
      ...s,
      questions: s.questions.filter((q) => !gone(q, q.code)),
      options: s.options.filter((x) => !gone(x, x.questionCode)),
      rules: s.rules.filter((r) => !gone(r, r.targetQuestion) && !gone(r, r.triggerQuestion)),
      defaultRules: s.defaultRules.filter((r) => !gone(r, r.targetQuestion) && !gone(r, r.triggerQuestion)),
    };
  }
  return { setup: pasteQuestions(s, fromType, picking, others, true).setup, types: others.length };
}
