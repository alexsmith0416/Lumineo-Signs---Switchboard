// Setup edits on the Field / Extended Description templates — the sentences a
// sign type's description is built from. Each returns a NEW SetupData.
import type { OutputType, Question, SetupData, SignLine, TemplateLine } from "../domain/types";
import { evaluate } from "../engine/flow";
import type { SetupIndex } from "../engine/setup-index";

const STEP = 10000;
const lower = (s: string) => s.trim().toLowerCase();
const isList = (q: Question) => q.answerType === "option" || q.answerType === "yesno";
const same = (t: TemplateLine, type: string, out: OutputType) => t.signTypeCode === type && t.outputType === out;

/** Tokens that aren't questions. */
export const FIXED_TOKENS: { token: string; means: string }[] = [
  { token: "QTY", means: "Quantity" },
  { token: "TYPE", means: "Sign type's print name" },
  { token: "SIGN", means: "Sign name" },
  { token: "DESIGNREF", means: "Design reference" },
  { token: "JOB", means: "Job no." },
];

export function linesOf(setup: SetupData, type: string, out: OutputType): TemplateLine[] {
  return setup.templates.filter((t) => same(t, type, out)).sort((a, b) => a.lineNo - b.lineNo);
}

export type TemplatePatch = Partial<Omit<TemplateLine, "signTypeCode" | "outputType" | "lineNo">>;

export function updateTemplateLine(setup: SetupData, type: string, out: OutputType, lineNo: number, patch: TemplatePatch): SetupData {
  return { ...setup, templates: setup.templates.map((t) => (same(t, type, out) && t.lineNo === lineNo ? { ...t, ...patch } : t)) };
}

/** Line numbers 10000, 20000… again (keeps the order). */
function renumber(setup: SetupData, type: string, out: OutputType): SetupData {
  const map = new Map(linesOf(setup, type, out).map((t, i) => [t.lineNo, (i + 1) * STEP]));
  return { ...setup, templates: setup.templates.map((t) => (same(t, type, out) ? { ...t, lineNo: map.get(t.lineNo)! } : t)) };
}

/** Adds a blank line after `afterLineNo` (0 = at the top; undefined = at the end). Returns the new line's number too. */
export function addTemplateLine(setup: SetupData, type: string, out: OutputType, afterLineNo?: number, init: TemplatePatch = {}): { setup: SetupData; lineNo: number } {
  let s = setup;
  const pick = () => {
    const lines = linesOf(s, type, out);
    const after = afterLineNo;
    if (after === undefined) return (lines[lines.length - 1]?.lineNo ?? 0) + STEP;
    const next = lines.find((t) => t.lineNo > after);
    if (!next) return after + STEP;
    return next.lineNo - after >= 2 ? Math.floor((after + next.lineNo) / 2) : null;
  };
  let lineNo = pick();
  if (lineNo === null) {
    // No room between the two: renumber, then find the same spot again.
    const pos = linesOf(s, type, out).findIndex((t) => t.lineNo === afterLineNo);
    s = renumber(s, type, out);
    afterLineNo = pos < 0 ? 0 : (pos + 1) * STEP;
    lineNo = pick()!;
  }
  const line: TemplateLine = {
    signTypeCode: type, outputType: out, lineNo, text: "", conditionQuestion: "", conditionValues: "",
    andConditionQuestion: "", andConditionValues: "", newParagraph: false, ...init,
  };
  return { setup: { ...s, templates: [...s.templates, line] }, lineNo };
}

export function deleteTemplateLine(setup: SetupData, type: string, out: OutputType, lineNo: number): SetupData {
  return { ...setup, templates: setup.templates.filter((t) => !(same(t, type, out) && t.lineNo === lineNo)) };
}

/** Swaps the line with the one above (-1) or below (+1). */
export function moveTemplateLine(setup: SetupData, type: string, out: OutputType, lineNo: number, dir: -1 | 1): SetupData {
  const lines = linesOf(setup, type, out);
  const i = lines.findIndex((t) => t.lineNo === lineNo);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= lines.length) return setup;
  const a = lines[i]!.lineNo;
  const b = lines[j]!.lineNo;
  return {
    ...setup,
    templates: setup.templates.map((t) => (!same(t, type, out) ? t : t.lineNo === a ? { ...t, lineNo: b } : t.lineNo === b ? { ...t, lineNo: a } : t)),
  };
}

/** Replaces this sign type's template with another's (the other's lines, copied). */
export function copyTemplateFrom(setup: SetupData, fromType: string, toType: string, out: OutputType): SetupData {
  const copied = linesOf(setup, fromType, out).map((t) => ({ ...t, signTypeCode: toType }));
  return { ...setup, templates: [...setup.templates.filter((t) => !same(t, toType, out)), ...copied] };
}

/** Swaps question `from` for `to` everywhere in one line (tokens and conditions). */
export function replaceQuestionInLine(line: TemplateLine, from: string, to: string): TemplatePatch {
  const f = from.toUpperCase();
  return {
    text: line.text.replace(/\{(L?Q):([^}]*)\}/gi, (m, kind: string, code: string) => (code.trim().toUpperCase() === f ? `{${kind.toUpperCase()}:${to}}` : m)),
    conditionQuestion: line.conditionQuestion.toUpperCase() === f ? to : line.conditionQuestion,
    andConditionQuestion: line.andConditionQuestion.toUpperCase() === f ? to : line.andConditionQuestion,
  };
}

// ---- Checks -------------------------------------------------------------------------

export interface LineProblem {
  kind: "missingQuestion" | "unknownToken" | "valueNotAnswer";
  /** The missing question / unknown token / question whose answers don't match. */
  code: string;
  text: string;
}

/** Question codes the line refers to: its {Q:…}/{LQ:…} tokens and conditions. */
export function questionsUsed(line: TemplateLine): string[] {
  const codes = [...line.text.matchAll(/\{L?Q:([^}]*)\}/gi)].map((m) => m[1]!.trim().toUpperCase());
  if (line.conditionQuestion) codes.push(line.conditionQuestion.toUpperCase());
  if (line.andConditionQuestion) codes.push(line.andConditionQuestion.toUpperCase());
  return [...new Set(codes)];
}

export function templateLineProblems(idx: SetupIndex, line: TemplateLine): LineProblem[] {
  const type = line.signTypeCode;
  const out: LineProblem[] = [];
  for (const code of questionsUsed(line)) {
    if (!idx.question(type, code)) out.push({ kind: "missingQuestion", code, text: `uses question ${code}, which this sign type doesn't have — the line is ${lineIsSkipped(line, code) ? "never printed" : "printed without it"}.` });
  }
  for (const m of line.text.matchAll(/\{([^}]*)\}/g)) {
    const tok = m[1]!.trim().toUpperCase();
    if (/^L?Q:/.test(tok)) continue;
    if (!FIXED_TOKENS.some((f) => f.token === tok)) out.push({ kind: "unknownToken", code: tok, text: `{${m[1]}} isn't a token the description knows — the line is never printed.` });
  }
  for (const [code, values] of [
    [line.conditionQuestion, line.conditionValues],
    [line.andConditionQuestion, line.andConditionValues],
  ] as const) {
    const q = code ? idx.question(type, code) : undefined;
    if (!q || !values || !isList(q) || q.allowFreeText) continue;
    const answers = idx.options(type, q.code).map((o) => lower(o.value));
    const bad = (values.startsWith("!") ? values.slice(1) : values)
      .split("|")
      .map((v) => v.trim())
      .filter((v) => v && !answers.includes(lower(v)));
    if (bad.length) out.push({ kind: "valueNotAnswer", code: q.code, text: `prints when "${q.prompt}" is ${bad.map((b) => `"${b}"`).join(" or ")}, which isn't one of its answers.` });
  }
  return out;
}

/** A {Q:} token on a missing question is blank, which skips the line; as a
 *  condition it is never answered, so only a "!…" (not) condition still passes. */
function lineIsSkipped(line: TemplateLine, code: string): boolean {
  if ([...line.text.matchAll(/\{L?Q:([^}]*)\}/gi)].some((m) => m[1]!.trim().toUpperCase() === code)) return true;
  if (line.conditionQuestion.toUpperCase() === code && !line.conditionValues.startsWith("!")) return true;
  return line.andConditionQuestion.toUpperCase() === code && !line.andConditionValues.startsWith("!");
}

/** Questions on this type worth offering in place of a missing one — similar code or wording first. */
export function suggestReplacements(idx: SetupIndex, type: string, missing: string): Question[] {
  const m = missing.toUpperCase();
  const parts = m.split("_").filter((p) => p.length >= 4);
  const score = (q: Question) => {
    const c = q.code;
    let s = 0;
    for (const p of parts) {
      if (c.includes(p)) s += 3;
      else if (p.length >= 5 && c.includes(p.slice(0, 5))) s += 2;
    }
    if (lower(q.prompt).includes(lower(m.replace(/_/g, " ")))) s += 2;
    return s;
  };
  return idx
    .questions(type)
    .map((q) => ({ q, s: score(q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.q);
}

// ---- Preview ------------------------------------------------------------------------

/** A sample sign of the type for the preview: every question that comes up is
 *  answered — with `picks` where given, else its default / first answer
 *  offered, else "[Label]" for typed answers. */
export function sampleSign(idx: SetupIndex, type: string, picks: Record<string, string>): SignLine {
  const t = idx.signType(type);
  let line: SignLine = {
    id: "preview", specId: "preview", lineNo: STEP, signName: "Sample sign", categoryCode: t?.categoryCode ?? "", signTypeCode: type,
    quantity: 1, answers: {}, specCode: "", specReferenceCode: "", typeDecided: true, completedPct: 0,
  };
  const questions = idx.questions(type);
  for (let pass = 0; pass < 20; pass++) {
    const ev = evaluate(idx, line, "full");
    const answers = { ...ev.line.answers };
    let changed = false;
    for (const q of questions) {
      const st = ev.states[q.code];
      if (!st?.visible && !st?.eligible) continue;
      const cur = answers[q.code]?.v ?? "";
      const want = picks[q.code] ?? (cur || sampleAnswer(idx, type, q, st.restricted ? st.allowed : undefined));
      if (want !== cur) {
        answers[q.code] = { ...answers[q.code], v: want, u: true };
        changed = true;
      }
    }
    line = { ...ev.line, answers };
    const qty = parseInt(answers.QTY?.v ?? "", 10);
    if (qty > 0) line.quantity = qty;
    if (!changed) break;
  }
  return evaluate(idx, line, "full").line;
}

function sampleAnswer(idx: SetupIndex, type: string, q: Question, allowed?: string[]): string {
  if (q.code === "QTY") return q.defaultValue || "1";
  if (isList(q)) {
    const offered = allowed?.length ? allowed : idx.options(type, q.code).map((o) => o.value);
    if (q.defaultValue && offered.some((o) => lower(o) === lower(q.defaultValue))) return q.defaultValue;
    return offered[0] ?? (q.answerType === "yesno" ? "Yes" : "");
  }
  return q.defaultValue || `[${q.outputLabel || q.prompt}]`;
}
