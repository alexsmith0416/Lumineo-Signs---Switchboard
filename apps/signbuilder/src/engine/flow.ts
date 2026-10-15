// The spec form's question flow — a port of the BC extension's LSB Spec Mgt.
// (RecalcVisibility, NormalizeAnswer, RouteSignType…) and LSB Spec Flow Engine.
//
//   Shown   = stage isn't Not Asked, AND (Scope Global OR a Spec Rule from an
//             answer given on the sign shows it), AND its Also Requires is met.
//   Allowed = the answers an active rule offers; all of them if none does.
//   Visible = shown, in scope for the detail level, and reached: the form asks
//             in order and waits at the first required question still blank.
//
// Everything here is pure: a sign line in, a new sign line (+ what the user
// should be told) out. The stores persist the result.
import type {
  AnswerState,
  DetailLevel,
  Question,
  SignLine,
  StoredAnswer,
} from "../domain/types";
import { OPEN_DESIGN_VALUE, SURVEY_VALUE } from "../domain/types";
import type { SetupIndex } from "./setup-index";
import {
  conditionMet,
  formatSizes,
  isPendingValue,
  isSurveyValue,
  parseSizes,
  sameAnswer,
} from "./values";

export const QTY_CODE = "QTY";

export interface ClearedNotice {
  prompt: string;
  value: string;
}

export interface Evaluation {
  line: SignLine;
  states: Record<string, AnswerState>;
  /** Answers people gave that this change cleared (no longer asked / offered). */
  cleared: ClearedNotice[];
  requiredTotal: number;
  requiredAnswered: number;
  missingRequired: number;
  openSurveys: number;
}

const blank = (): StoredAnswer => ({ v: "" });

function cloneAnswers(answers: Record<string, StoredAnswer>): Record<string, StoredAnswer> {
  const out: Record<string, StoredAnswer> = {};
  for (const [k, a] of Object.entries(answers)) out[k] = { ...a, s: a.s ? [...a.s] : undefined };
  return out;
}

function isListQuestion(q: Question): boolean {
  return q.answerType === "option" || q.answerType === "yesno";
}

/** Required = required and not a "Later" stage question. */
export function isRequired(q: Question): boolean {
  return q.required && q.stage !== "later";
}

// ---------------------------------------------------------------------------
// Evaluate a sign
// ---------------------------------------------------------------------------

export function evaluate(idx: SetupIndex, input: SignLine, detail: DetailLevel, currentCode = ""): Evaluation {
  const line: SignLine = { ...input, answers: cloneAnswers(input.answers) };
  const questions = idx.questions(line.signTypeCode);
  const answers = line.answers;
  for (const q of questions) if (!answers[q.code]) answers[q.code] = blank();
  const cleared: ClearedNotice[] = [];
  const full = detail === "full";

  const triggerActive = (question: string, answer: string): boolean => {
    const a = answers[question];
    if (!a || !a.e || a.v === "" || isPendingValue(a.v)) return false;
    return answer === "" || sameAnswer(a.v, answer);
  };

  const shown = (q: Question): boolean => {
    if (q.stage === "notAsked") return false;
    if (q.scope === "conditional") {
      const rules = idx.rulesTo(line.signTypeCode, q.code);
      if (!rules.some((r) => triggerActive(r.triggerQuestion, r.triggerAnswer))) return false;
    }
    if (q.alsoRequiresQuestion) {
      const p = answers[q.alsoRequiresQuestion];
      if (!p || !p.e) return false;
      return conditionMet(p.v, q.alsoRequiresValues);
    }
    return true;
  };

  const allowedFor = (q: Question): { restricted: boolean; allowed: string[] } => {
    const allowed: string[] = [];
    for (const r of idx.rulesTo(line.signTypeCode, q.code)) {
      if (r.targetAnswer === "") continue;
      if (allowed.some((x) => sameAnswer(x, r.targetAnswer))) continue;
      if (triggerActive(r.triggerQuestion, r.triggerAnswer)) allowed.push(r.targetAnswer);
    }
    return { restricted: allowed.length > 0, allowed };
  };

  const answerAllowed = (q: Question, value: string): boolean => {
    if (!isListQuestion(q) || isPendingValue(value)) return true;
    const { restricted, allowed } = allowedFor(q);
    if (!restricted || allowed.some((x) => sameAnswer(x, value))) return true;
    // A typed free-text answer (not one of the listed ones) still goes through.
    return !idx.option(line.signTypeCode, q.code, value);
  };

  // The question's default right now: the first Default Rule whose trigger
  // answer is given — rules for a specific answer before "any answer" ones —
  // else its own Default Value.
  const defaultFor = (q: Question): string => {
    const rules = idx.defaultRulesTo(line.signTypeCode, q.code);
    for (const r of rules) if (r.triggerAnswer !== "" && triggerActive(r.triggerQuestion, r.triggerAnswer)) return r.value;
    for (const r of rules) if (r.triggerAnswer === "" && triggerActive(r.triggerQuestion, "")) return r.value;
    return q.defaultValue ?? "";
  };

  const applyDefault = (q: Question, a: StoredAnswer) => {
    a.v = defaultFor(q);
    a.s = undefined;
    if (a.v && q.answerType === "dimension") {
      try {
        const sizes = parseSizes(a.v, q.dimensionParts || 3);
        a.s = sizes;
        a.v = formatSizes(sizes, q.dimensionLabels);
      } catch {
        /* keep the default as written */
      }
    }
  };

  const clear = (a: StoredAnswer) => {
    a.v = "";
    a.s = undefined;
  };

  // 1. Which questions apply (repeat until nothing changes — an answer can
  //    bring up a question whose own answer brings up another).
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const q of questions) {
      const a = answers[q.code]!;
      const now = shown(q);
      if (now !== !!a.e) {
        a.e = now;
        if (!now) {
          if (a.u && a.v !== "" && q.code !== currentCode) cleared.push({ prompt: q.prompt, value: a.v });
          clear(a);
          a.u = false;
        } else if (a.v === "") {
          applyDefault(q, a);
        }
        changed = true;
      }
      if (a.e && a.v !== "" && !answerAllowed(q, a.v)) {
        if (a.u && q.code !== currentCode) cleared.push({ prompt: q.prompt, value: a.v });
        clear(a);
        a.u = false;
        applyDefault(q, a);
        if (a.v !== "" && !answerAllowed(q, a.v)) clear(a);
        changed = true;
      }
      // Default Rules: an answer the person didn't pick follows its trigger
      // (Pan depth 2” → 2”x2”; change the depth and the default changes too).
      if (a.e && !a.u && idx.defaultRulesTo(line.signTypeCode, q.code).length > 0) {
        const next: StoredAnswer = { ...a };
        applyDefault(q, next);
        if (next.v !== a.v && (next.v === "" || answerAllowed(q, next.v))) {
          a.v = next.v;
          a.s = next.s;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // 2. What the form shows: in scope for the detail level, and reached (the
  //    form stops at the first required question still blank). "Show With
  //    Previous" questions ride along with the question before them.
  const states: Record<string, AnswerState> = {};
  let reached = true;
  let stepFound = false;
  let previousShown = false;
  let requiredTotal = 0;
  let requiredAnswered = 0;
  let openSurveys = 0;
  for (const q of questions) {
    const a = answers[q.code]!;
    const inScope = full || q.stage === "opportunity";
    let answered = a.v !== "";
    if (answered && full) answered = !isPendingValue(a.v);
    const eligible = !!a.e;
    const visible: boolean = eligible && inScope && (reached || (q.showWithPrevious && previousShown));
    let nextStep = false;
    if (visible && isRequired(q) && a.v === "") {
      nextStep = !stepFound;
      stepFound = true;
      reached = false;
    }
    if (eligible && inScope) previousShown = visible;
    const { restricted, allowed } = eligible && isListQuestion(q) ? allowedFor(q) : { restricted: false, allowed: [] };
    states[q.code] = {
      questionCode: q.code,
      value: a.v,
      sizes: a.s ?? [],
      userEntered: !!a.u,
      eligible,
      visible,
      nextStep,
      inScope,
      answered,
      restricted,
      allowed,
    };
    if (eligible && inScope && isRequired(q)) {
      requiredTotal++;
      if (answered) requiredAnswered++;
    }
    if (eligible && isSurveyValue(a.v)) openSurveys++;
  }

  // 3. The sign's summary: type decided, Spec Code, reference page, % done.
  const typeDecided = isTypeDecided(idx, line, answers);
  line.typeDecided = typeDecided;
  line.specCode = buildSpecCode(idx, line, answers, typeDecided);
  line.specReferenceCode = typeDecided ? findReference(idx, line, answers) : "";
  line.completedPct = line.signTypeCode === "" ? 0 : requiredTotal === 0 ? 100 : Math.round((requiredAnswered / requiredTotal) * 100);

  return {
    line,
    states,
    cleared,
    requiredTotal,
    requiredAnswered,
    missingRequired: requiredTotal - requiredAnswered,
    openSurveys,
  };
}

// ---------------------------------------------------------------------------
// Sign type picking (the first questions: Lighted?, New or existing?…)
// ---------------------------------------------------------------------------

function realAnswer(answers: Record<string, StoredAnswer>, code: string): string {
  const a = answers[code];
  if (!a || !a.e || isPendingValue(a.v)) return "";
  return a.v;
}

/** 'LIT=Yes; WORK=New cabinet' — every part needs a real answer that matches. */
export function selectedWhenMet(answers: Record<string, StoredAnswer>, selectedWhen: string): boolean {
  for (const raw of selectedWhen.split(";")) {
    const part = raw.trim();
    if (part === "") continue;
    const eq = part.indexOf("=");
    if (eq < 1) return false;
    const value = realAnswer(answers, part.slice(0, eq).trim().toUpperCase());
    if (value === "" || !conditionMet(value, part.slice(eq + 1))) return false;
  }
  return true;
}

function isTypeDecided(idx: SetupIndex, line: SignLine, answers: Record<string, StoredAnswer>): boolean {
  const type = idx.signType(line.signTypeCode);
  if (!type) return false;
  for (const q of idx.questions(line.signTypeCode)) {
    if (!q.picksSignType) continue;
    const a = answers[q.code];
    if (a?.e && (a.v === "" || isPendingValue(a.v))) return false;
  }
  return type.selectedWhen === "" || selectedWhenMet(answers, type.selectedWhen);
}

/** Prefix + type segment (once decided) + each chosen answer's segment. */
function buildSpecCode(idx: SetupIndex, line: SignLine, answers: Record<string, StoredAnswer>, typeDecided: boolean): string {
  const type = idx.signType(line.signTypeCode);
  if (!type) return "";
  const parts: string[] = [];
  const prefix = idx.category(type.categoryCode)?.codePrefix ?? "";
  if (prefix) parts.push(prefix);
  if (typeDecided && type.specCode) parts.push(type.specCode);
  for (const q of idx.questions(line.signTypeCode)) {
    const a = answers[q.code];
    if (!a?.e || a.v === "" || isPendingValue(a.v)) continue;
    const seg = idx.option(line.signTypeCode, q.code, a.v)?.codeSegment;
    if (seg) parts.push(seg);
  }
  return parts.join("-");
}

function findReference(idx: SetupIndex, line: SignLine, answers: Record<string, StoredAnswer>): string {
  for (const rule of idx.referenceRules(line.signTypeCode)) {
    const ok = (q: string, values: string) => q === "" || conditionMet(realAnswer(answers, q), values);
    if (ok(rule.conditionQuestion, rule.conditionValues) && ok(rule.andConditionQuestion, rule.andConditionValues)) return rule.referenceCode;
  }
  return "";
}

/** The sign type of the category whose Selected When the answers meet ('' if none). */
export function routeSignType(idx: SetupIndex, line: SignLine): string {
  for (const t of idx.typesOfCategory(line.categoryCode)) {
    if (t.selectedWhen !== "" && selectedWhenMet(line.answers, t.selectedWhen)) return t.code;
  }
  return "";
}

/** Move a sign to another sign type: answers people gave carry over where the
 *  new type asks the same question (same kind of answer); defaults restart. */
export function retarget(idx: SetupIndex, line: SignLine, newTypeCode: string, keepUserOnly: boolean): SignLine {
  const answers: Record<string, StoredAnswer> = {};
  for (const q of idx.questions(newTypeCode)) {
    const old = line.answers[q.code];
    const oldQ = idx.question(line.signTypeCode, q.code);
    if (old && (!oldQ || oldQ.answerType === q.answerType) && (!keepUserOnly || old.u)) {
      answers[q.code] = { ...old, s: old.s ? [...old.s] : undefined };
    } else {
      answers[q.code] = blank();
    }
  }
  return { ...line, signTypeCode: newTypeCode, answers };
}

// ---------------------------------------------------------------------------
// Starting a sign
// ---------------------------------------------------------------------------

export function newSignLine(idx: SetupIndex, specId: string, lineNo: number, categoryCode: string, detail: DetailLevel): SignLine {
  const first = idx.firstSignType(categoryCode);
  const line: SignLine = {
    id: crypto.randomUUID(),
    specId,
    lineNo,
    signName: "",
    categoryCode,
    signTypeCode: first?.code ?? "",
    quantity: 1,
    answers: { [QTY_CODE]: { v: "1", u: true } },
    specCode: "",
    specReferenceCode: "",
    typeDecided: false,
    completedPct: 0,
  };
  return evaluate(idx, line, detail).line;
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

export interface AnswerResult {
  evaluation: Evaluation;
  /** Shown to the user, e.g. when no sign type is set up for the answers. */
  message?: string;
}

/**
 * Validate and store one answer, then re-run the flow. Throws an Error with a
 * user-facing message when the input can't be accepted (the form shows it).
 */
export function answerQuestion(
  idx: SetupIndex,
  line: SignLine,
  detail: DetailLevel,
  questionCode: string,
  input: string,
  sizes?: number[],
): AnswerResult {
  const q = idx.question(line.signTypeCode, questionCode);
  if (!q) throw new Error(`Question ${questionCode} isn't on this sign.`);
  const before = evaluate(idx, line, detail);
  const state = before.states[questionCode];
  const stored = normalizeAnswer(idx, q, input, sizes, state);

  let next: SignLine = { ...before.line, answers: { ...before.line.answers } };
  next.answers[questionCode] = { ...stored, u: stored.v !== "", e: next.answers[questionCode]?.e };
  if (questionCode === QTY_CODE) {
    const n = parseInt(stored.v, 10);
    if (n > 0) next.quantity = n;
  }
  let evaluation = evaluate(idx, next, detail, questionCode);
  let message: string | undefined;

  if (q.picksSignType) {
    const target = routeSignType(idx, evaluation.line);
    if (target && target !== evaluation.line.signTypeCode) {
      next = retarget(idx, evaluation.line, target, true);
      const cleared = evaluation.cleared;
      evaluation = evaluate(idx, next, detail, questionCode);
      evaluation.cleared = [...cleared, ...evaluation.cleared];
    } else if (!target && allPickingAnswered(idx, evaluation.line)) {
      const type = idx.signType(evaluation.line.signTypeCode);
      message = `No sign type is set up yet for this combination of answers, so the sign keeps the questions of "${type?.description ?? ""}". Add one under Setup → Sign Types (Duplicate is the quickest way).`;
    }
  }
  return { evaluation, message };
}

function allPickingAnswered(idx: SetupIndex, line: SignLine): boolean {
  return idx
    .questions(line.signTypeCode)
    .filter((q) => q.picksSignType)
    .every((q) => {
      const a = line.answers[q.code];
      return !a?.e || (a.v !== "" && !isPendingValue(a.v));
    });
}

/** The Qty column and the Quantity question stay in step. */
export function setQuantity(idx: SetupIndex, line: SignLine, detail: DetailLevel, quantity: number): Evaluation {
  if (quantity < 1) throw new Error("Quantity must be at least 1.");
  const next: SignLine = { ...line, quantity, answers: { ...line.answers } };
  if (idx.question(line.signTypeCode, QTY_CODE)) next.answers[QTY_CODE] = { ...next.answers[QTY_CODE], v: String(quantity), u: true };
  return evaluate(idx, next, detail);
}

/** Typed / picked input → what is stored. Throws a user message. */
export function normalizeAnswer(
  idx: SetupIndex,
  q: Question,
  rawInput: string,
  sizes: number[] | undefined,
  state: AnswerState | undefined,
): StoredAnswer {
  const input = (rawInput ?? "").trim();
  if (input === "" && !(sizes && sizes.length)) return { v: "" };
  const lower = input.toLowerCase();
  if (q.allowSurvey && ["needs survey", "survey", "survey needed", "tbd survey"].includes(lower)) return { v: SURVEY_VALUE };
  if (q.allowOpenForDesign && ["open for design", "open", "design", "tbd"].includes(lower)) return { v: OPEN_DESIGN_VALUE };

  let value = input;
  let outSizes: number[] | undefined;
  switch (q.answerType) {
    case "option":
      value = matchOption(idx, q, input);
      break;
    case "yesno":
      if (["y", "yes", "true", "1"].includes(lower)) value = "Yes";
      else if (["n", "no", "false", "0"].includes(lower)) value = "No";
      else if (!isPendingValue(input)) throw new Error("Answer Yes or No.");
      break;
    case "number": {
      let t = input.replace(/["”'’\s]/g, "");
      if (q.unit) t = t.split(q.unit).join("");
      const n = Number(t);
      if (!Number.isFinite(n) || t === "") throw new Error(`"${input}" is not a number.`);
      value = String(n) + (q.unit ?? "");
      break;
    }
    case "dimension": {
      outSizes = sizes && sizes.length ? sizes : parseSizes(input, q.dimensionParts || 3);
      value = formatSizes(outSizes, q.dimensionLabels);
      break;
    }
    default:
      break;
  }

  // Rules may limit the answers on this branch.
  if (state?.restricted && isListQuestion(q) && !isPendingValue(value)) {
    const offered = state.allowed.some((a) => sameAnswer(a, value));
    if (!offered && idx.option(q.signTypeCode, q.code, value)) {
      throw new Error(`"${value}" isn't offered for "${q.prompt}" on this sign. Choices here: ${state.allowed.join(", ")}`);
    }
  }
  return { v: value, s: outSizes };
}

/** Exact match, "also matches" words, then a unique starts-with / contains. */
function matchOption(idx: SetupIndex, q: Question, input: string): string {
  const lower = input.toLowerCase();
  const options = idx.options(q.signTypeCode, q.code);
  let starts: string[] = [];
  let contains: string[] = [];
  for (const o of options) {
    const v = o.value.toLowerCase();
    if (v === lower) return o.value;
    if (o.alsoMatches && conditionMet(lower, o.alsoMatches)) return o.value;
    if (v.startsWith(lower)) starts.push(o.value);
    if (v.includes(lower)) contains.push(o.value);
  }
  if (starts.length === 1) return starts[0]!;
  if (starts.length === 0 && contains.length === 1) return contains[0]!;
  if (q.allowFreeText) return input;
  const choices = options.map((o) => o.value).join(", ");
  if (starts.length > 1 || contains.length > 1) throw new Error(`"${input}" matches more than one choice for "${q.prompt}". Choices: ${choices}`);
  throw new Error(`"${input}" isn't one of the choices for "${q.prompt}". Choices: ${choices}`);
}

/** The answer as it prints: '' when the question doesn't apply or is still
 *  pending; an "Other" choice replaced by its <CODE>_OTHER question. */
export function printedAnswer(line: SignLine, code: string): string {
  const a = line.answers[code];
  if (!a || !a.e || isPendingValue(a.v)) return "";
  if (a.v.toLowerCase() === "other") {
    const other = line.answers[`${code}_OTHER`];
    if (other?.e && other.v) return other.v;
  }
  return a.v;
}
