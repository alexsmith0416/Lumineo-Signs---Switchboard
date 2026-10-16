// Test & Path: run a category's real question flow on a throwaway sign (never
// saved), say why a question doesn't show, and fill in the answers that make a
// given question show — a port of the BC extension's Show Path (LSB Path Mgt.).
import type { AnswerState, Question, SignLine } from "../domain/types";
import { answerQuestion, evaluate, newSignLine, retarget } from "../engine/flow";
import type { SetupIndex } from "../engine/setup-index";
import { conditionMet, isPendingValue, sameAnswer } from "../engine/values";
import { shownWhen } from "./question-ops";

const isList = (q: Question) => q.answerType === "option" || q.answerType === "yesno";

/** A new test sign of the category, at full detail. */
export function testSign(idx: SetupIndex, categoryCode: string): SignLine {
  return { ...newSignLine(idx, "test", 10000, categoryCode, "full"), id: "test", signName: "Test sign" };
}

/** An answer that meets a rule's values: the first listed one, the first
 *  answer not excluded ("!A|B"), or — for "any answer" — the first answer. */
export function firstAllowed(idx: SetupIndex, type: string, code: string, values: string): string {
  const q = idx.question(type, code);
  const options = idx.realOptions(type, code).map((o) => o.value);
  const v = values.trim();
  if (v && !v.startsWith("!")) return v.split("|")[0]!.trim();
  const not = v ? v.slice(1).split("|").map((x) => x.trim()) : [];
  const pick = options.find((o) => !not.some((n) => sameAnswer(n, o)));
  if (pick) return pick;
  if (q?.answerType === "yesno") return not.some((n) => sameAnswer(n, "Yes")) ? "No" : "Yes";
  return q && isList(q) ? "" : "Test";
}

/** Answers one question on the test sign; keeps it on `keepType` when given
 *  (a type-picking answer would otherwise move it). Errors are ignored. */
function put(idx: SetupIndex, line: SignLine, code: string, value: string, keepType?: string): SignLine {
  if (!value) return line;
  let next = line;
  try {
    next = answerQuestion(idx, line, "full", code, value).evaluation.line;
  } catch {
    return line;
  }
  if (keepType && next.signTypeCode !== keepType) next = evaluate(idx, retarget(idx, next, keepType, true), "full").line;
  return next;
}

/** The first questions answered so they pick this sign type (or the sign put on it when they can't). */
export function signOfType(idx: SetupIndex, type: string): SignLine {
  const t = idx.signType(type);
  let line = testSign(idx, t?.categoryCode ?? "");
  for (const part of (t?.selectedWhen ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    line = put(idx, line, part.slice(0, eq).trim().toUpperCase(), part.slice(eq + 1).split("|")[0]!.trim());
  }
  if (line.signTypeCode !== type) line = evaluate(idx, { ...retarget(idx, line, type, true), typeDecided: true }, "full").line;
  return line;
}

/** A test sign of the type where `questionCode` shows — the answers its rules
 *  need (and what those answers' questions need first) filled in — with
 *  `answer` chosen for it when given. */
export function seedPath(idx: SetupIndex, type: string, questionCode: string, answer = ""): SignLine {
  let line = signOfType(idx, type);
  const seen = new Set<string>();
  const satisfy = (code: string, depth: number) => {
    if (depth > 12 || seen.has(code)) return;
    seen.add(code);
    const q = idx.question(type, code);
    if (!q) return;
    if (q.scope === "conditional") {
      const rule = idx.rulesTo(type, code).find((r) => r.targetAnswer === "" && idx.question(type, r.triggerQuestion));
      if (rule) {
        satisfy(rule.triggerQuestion, depth + 1);
        const cur = line.answers[rule.triggerQuestion];
        if (!cur?.e || !(rule.triggerAnswer === "" ? cur.v !== "" && !isPendingValue(cur.v) : sameAnswer(cur.v, rule.triggerAnswer))) {
          line = put(idx, line, rule.triggerQuestion, rule.triggerAnswer || firstAllowed(idx, type, rule.triggerQuestion, ""), type);
        }
      }
    }
    if (q.alsoRequiresQuestion && idx.question(type, q.alsoRequiresQuestion)) {
      satisfy(q.alsoRequiresQuestion, depth + 1);
      const cur = line.answers[q.alsoRequiresQuestion];
      if (!cur?.e || !conditionMet(cur.v, q.alsoRequiresValues)) {
        line = put(idx, line, q.alsoRequiresQuestion, firstAllowed(idx, type, q.alsoRequiresQuestion, q.alsoRequiresValues), type);
      }
    }
  };
  satisfy(questionCode, 0);
  if (answer) line = put(idx, line, questionCode, answer, type);
  return line;
}

/** Why a question doesn't show on this sign right now ("" when it does). */
export function hiddenReason(idx: SetupIndex, line: SignLine, q: Question, state: AnswerState | undefined): string {
  if (state?.visible) return "";
  if (state?.eligible) {
    if (!state.inScope) return "Only asked at Job details";
    return "Comes after a required question that's still blank";
  }
  if (q.stage === "notAsked") return "Never asked (stage: Not asked)";
  const type = line.signTypeCode;
  const active = (code: string, answer: string) => {
    const a = line.answers[code];
    return !!a?.e && a.v !== "" && !isPendingValue(a.v) && (answer === "" || sameAnswer(a.v, answer));
  };
  if (q.scope === "conditional" && !idx.rulesTo(type, q.code).some((r) => r.targetAnswer === "" && active(r.triggerQuestion, r.triggerAnswer))) {
    const when = shownWhen(idx, q);
    return `No rule shows it with these answers — ${when.charAt(0).toLowerCase()}${when.slice(1)}`;
  }
  if (q.alsoRequiresQuestion) {
    const parent = idx.question(type, q.alsoRequiresQuestion);
    if (!parent) return `Depends on ${q.alsoRequiresQuestion}, which this sign type doesn't have`;
    const a = line.answers[parent.code];
    const name = `“${parent.prompt.replace(/\?$/, "")}”`;
    if (!a?.e) return `${name} isn't asked`;
    const v = q.alsoRequiresValues.trim();
    const needs = !v ? "an answer" : v.startsWith("!") ? `anything but ${v.slice(1).split("|").join(" or ")}` : v.split("|").join(" or ");
    return a.v ? `${name} is ${a.v}; needs ${needs}` : `${name} is blank; needs ${needs}`;
  }
  return "Hidden";
}
