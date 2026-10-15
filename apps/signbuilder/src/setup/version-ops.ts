// Saved setup versions: what's in one, and what changed between two setups.
import type { SetupData, SetupStats, SetupVersion } from "../domain/types";

export function setupStats(setup: SetupData): SetupStats {
  return {
    categories: setup.categories.length,
    signTypes: setup.signTypes.filter((t) => !t.isBlock).length,
    questions: setup.questions.length,
    answers: setup.options.length,
    rules: setup.rules.length + setup.defaultRules.length,
    templates: setup.templates.length,
  };
}

export function newVersionHeader(setup: SetupData, label: string, note: string, kind: SetupVersion["kind"], createdBy: string): SetupVersion {
  return { id: crypto.randomUUID(), label: label.trim() || "Saved version", note: note.trim(), kind, createdAt: new Date().toISOString(), createdBy, stats: setupStats(setup) };
}

/** Order doesn't matter: compare as a sorted list of JSON rows. */
const sig = (list: unknown[]) => list.map((x) => JSON.stringify(x)).sort().join("\n");

const TYPE_PARTS = [
  ["details", "details / Selected When"],
  ["questions", "questions"],
  ["options", "answers"],
  ["rules", "rules"],
  ["defaultRules", "defaults"],
  ["templates", "descriptions"],
  ["referenceRules", "reference rules"],
] as const;

const CORE_PARTS = [
  ["categories", "Categories"],
  ["settings", "Settings"],
  ["checklist", "Stage checklist"],
  ["vinylColors", "Vinyl colors"],
  ["items", "BC items"],
  ["references", "Spec reference list"],
  ["sections", "Sections"],
] as const;

export interface SetupDiff {
  /** Setup-wide parts that differ (Categories, Settings…). */
  general: string[];
  added: { code: string; name: string }[];
  removed: { code: string; name: string }[];
  changed: { code: string; name: string; parts: string[] }[];
}

/** What changed going from `from` to `to`, by sign type. */
export function diffSetups(from: SetupData, to: SetupData): SetupDiff {
  const general = CORE_PARTS.filter(([k]) => {
    const a = from[k] ?? [];
    const b = to[k] ?? [];
    if (k === "settings") return JSON.stringify(a) !== JSON.stringify(b);
    const strip = (l: unknown) => (k === "references" ? (l as { thumbnail?: string; fullImage?: string }[]).map(({ thumbnail: _t, fullImage: _f, ...r }) => r) : (l as unknown[]));
    return sig(strip(a)) !== sig(strip(b));
  }).map(([, label]) => label);

  const typeParts = (s: SetupData, code: string) => {
    const by = <T extends { signTypeCode: string }>(l: T[]) => sig(l.filter((x) => x.signTypeCode === code));
    return {
      details: JSON.stringify(s.signTypes.find((t) => t.code === code) ?? null),
      questions: by(s.questions),
      options: by(s.options),
      rules: by(s.rules),
      defaultRules: by(s.defaultRules ?? []),
      templates: by(s.templates),
      referenceRules: by(s.referenceRules),
    };
  };
  const fromCodes = new Set(from.signTypes.map((t) => t.code));
  const toCodes = new Set(to.signTypes.map((t) => t.code));
  const name = (s: SetupData, code: string) => s.signTypes.find((t) => t.code === code)?.description ?? code;
  const diff: SetupDiff = { general, added: [], removed: [], changed: [] };
  for (const code of toCodes) if (!fromCodes.has(code)) diff.added.push({ code, name: name(to, code) });
  for (const code of fromCodes) {
    if (!toCodes.has(code)) {
      diff.removed.push({ code, name: name(from, code) });
      continue;
    }
    const a = typeParts(from, code);
    const b = typeParts(to, code);
    const parts = TYPE_PARTS.filter(([k]) => a[k] !== b[k]).map(([, label]) => label);
    if (parts.length) diff.changed.push({ code, name: name(to, code), parts });
  }
  const byName = (x: { name: string }, y: { name: string }) => x.name.localeCompare(y.name);
  diff.added.sort(byName);
  diff.removed.sort(byName);
  diff.changed.sort(byName);
  return diff;
}

export const isSameSetup = (d: SetupDiff) => !d.general.length && !d.added.length && !d.removed.length && !d.changed.length;
