// Setup edits on questions, answers and rules (Decision Tree / Rule Matrix).
// Each returns a NEW SetupData. All of them work within one sign type.
import type { AnswerOption, DefaultRule, Question, SetupData, SpecRule } from "../domain/types";
import type { SetupIndex } from "../engine/setup-index";

const lower = (s: string) => s.trim().toLowerCase();

// ---- Questions ------------------------------------------------------------------

export type QuestionPatch = Partial<Omit<Question, "signTypeCode" | "code">>;

export function updateQuestion(setup: SetupData, type: string, code: string, patch: QuestionPatch): SetupData {
  return { ...setup, questions: setup.questions.map((q) => (q.signTypeCode === type && q.code === code ? { ...q, ...patch } : q)) };
}

export function questionCodeError(setup: SetupData, type: string, code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return "Enter a code.";
  if (c.length > 30) return "Codes are at most 30 characters.";
  if (!/^[A-Z][A-Z0-9_]*$/.test(c)) return "Use letters, digits and _ (start with a letter).";
  if (setup.questions.some((q) => q.signTypeCode === type && q.code === c)) return `${c} is already a question on this sign type.`;
  return "";
}

/** A free code made from the wording: "Face frame material" → FACE_FRAME_MATERIAL (…_2 when taken). */
export function codeFromPrompt(setup: SetupData, type: string, prompt: string): string {
  const base =
    prompt
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^([0-9])/, "Q_$1")
      .slice(0, 26) || "QUESTION";
  let code = base;
  for (let n = 2; questionCodeError(setup, type, code); n++) code = `${base}_${n}`;
  return code;
}

export function addQuestion(setup: SetupData, type: string, code: string, prompt: string, after?: Question): SetupData {
  const c = code.trim().toUpperCase();
  const err = questionCodeError(setup, type, c);
  if (err) throw new Error(err);
  const mine = setup.questions.filter((q) => q.signTypeCode === type);
  const next = after ? mine.filter((q) => q.sortOrder > after.sortOrder).sort((a, b) => a.sortOrder - b.sortOrder)[0] : undefined;
  const sortOrder = after ? (next ? (after.sortOrder + next.sortOrder) / 2 : after.sortOrder + 10) : mine.reduce((m, q) => Math.max(m, q.sortOrder), 0) + 10;
  const q: Question = {
    signTypeCode: type, code: c, sectionCode: after?.sectionCode ?? setup.sections[0]?.code ?? "", sortOrder, prompt: prompt.trim() || c,
    outputLabel: "", answerType: "option", required: true, defaultValue: "", allowFreeText: false, inProduction: true, productionFormat: "",
    productionSubNote: "", hint: "", unit: "", dimensionParts: 2, dimensionLabels: "Height|Width|Depth", vinylSeries: "", alsoRequiresQuestion: "",
    alsoRequiresValues: "", showWithPrevious: false, stage: "job", allowSurvey: false, allowOpenForDesign: false, picksSignType: false, blockCode: "", scope: "global",
  };
  return { ...setup, questions: [...setup.questions, q] };
}

/** Removes the question with its answers and every rule on or about it. */
export function deleteQuestion(setup: SetupData, type: string, code: string): SetupData {
  const onType = <T extends { signTypeCode: string }>(x: T) => x.signTypeCode === type;
  return {
    ...setup,
    questions: setup.questions.filter((q) => !(onType(q) && q.code === code)),
    options: setup.options.filter((o) => !(onType(o) && o.questionCode === code)),
    rules: setup.rules.filter((r) => !(onType(r) && (r.triggerQuestion === code || r.targetQuestion === code))),
    defaultRules: setup.defaultRules.filter((r) => !(onType(r) && (r.triggerQuestion === code || r.targetQuestion === code))),
  };
}

// ---- Answers ----------------------------------------------------------------------

export type OptionPatch = Partial<Omit<AnswerOption, "signTypeCode" | "questionCode">>;

const swapValue = (list: string, from: string, to: string) => {
  const not = list.startsWith("!");
  const parts = (not ? list.slice(1) : list).split("|").map((x) => (lower(x) === lower(from) ? to : x));
  return (not ? "!" : "") + parts.join("|");
};

/** Edits an answer. Renaming it also renames it everywhere this sign type
 *  refers to it: rules, default rules, the question's default, template /
 *  reference conditions, Also requires and Selected When. */
export function updateOption(setup: SetupData, type: string, questionCode: string, value: string, patch: OptionPatch): SetupData {
  let next: SetupData = {
    ...setup,
    options: setup.options.map((o) => (o.signTypeCode === type && o.questionCode === questionCode && o.value === value ? { ...o, ...patch } : o)),
  };
  const to = patch.value;
  if (to === undefined || to === value) return next;
  const onType = <T extends { signTypeCode: string }>(x: T) => x.signTypeCode === type;
  next = {
    ...next,
    questions: next.questions.map((q) => {
      if (!onType(q)) return q;
      let r = q;
      if (q.code === questionCode && lower(q.defaultValue) === lower(value)) r = { ...r, defaultValue: to };
      if (q.alsoRequiresQuestion === questionCode && q.alsoRequiresValues) r = { ...r, alsoRequiresValues: swapValue(q.alsoRequiresValues, value, to) };
      return r;
    }),
    rules: next.rules.map((r) => {
      if (!onType(r)) return r;
      let x = r;
      if (r.triggerQuestion === questionCode && lower(r.triggerAnswer) === lower(value)) x = { ...x, triggerAnswer: to };
      if (r.targetQuestion === questionCode && lower(r.targetAnswer) === lower(value)) x = { ...x, targetAnswer: to };
      return x;
    }),
    defaultRules: next.defaultRules.map((r) => {
      if (!onType(r)) return r;
      let x = r;
      if (r.triggerQuestion === questionCode && lower(r.triggerAnswer) === lower(value)) x = { ...x, triggerAnswer: to };
      if (r.targetQuestion === questionCode && lower(r.value) === lower(value)) x = { ...x, value: to };
      return x;
    }),
    templates: next.templates.map((t) => {
      if (!onType(t)) return t;
      let x = t;
      if (t.conditionQuestion === questionCode && t.conditionValues) x = { ...x, conditionValues: swapValue(t.conditionValues, value, to) };
      if (t.andConditionQuestion === questionCode && t.andConditionValues) x = { ...x, andConditionValues: swapValue(t.andConditionValues, value, to) };
      return x;
    }),
    referenceRules: next.referenceRules.map((t) => {
      if (!onType(t)) return t;
      let x = t;
      if (t.conditionQuestion === questionCode && t.conditionValues) x = { ...x, conditionValues: swapValue(t.conditionValues, value, to) };
      if (t.andConditionQuestion === questionCode && t.andConditionValues) x = { ...x, andConditionValues: swapValue(t.andConditionValues, value, to) };
      return x;
    }),
    signTypes: next.signTypes.map((t) =>
      t.code === type && t.selectedWhen
        ? {
            ...t,
            selectedWhen: t.selectedWhen
              .split(";")
              .map((p) => {
                const i = p.indexOf("=");
                return i > 0 && p.slice(0, i).trim().toUpperCase() === questionCode ? `${p.slice(0, i + 1)}${swapValue(p.slice(i + 1).trim(), value, to)}` : p;
              })
              .join(";"),
          }
        : t,
    ),
  };
  return next;
}

export function addOption(setup: SetupData, type: string, questionCode: string, value: string): SetupData {
  const v = value.trim();
  const mine = setup.options.filter((o) => o.signTypeCode === type && o.questionCode === questionCode);
  if (!v) throw new Error("Enter the answer.");
  if (mine.some((o) => lower(o.value) === lower(v))) throw new Error(`"${v}" is already an answer.`);
  const sortOrder = mine.reduce((m, o) => Math.max(m, o.sortOrder), 0) + 10;
  return {
    ...setup,
    options: [...setup.options, { signTypeCode: type, questionCode, value: v, sortOrder, hint: "", alsoMatches: "", codeSegment: "", outputText: "", productionFormat: "" }],
  };
}

/** Removes an answer and the rules that stand on it or offer it. */
export function removeOption(setup: SetupData, type: string, questionCode: string, value: string): SetupData {
  const onType = <T extends { signTypeCode: string }>(x: T) => x.signTypeCode === type;
  return {
    ...setup,
    options: setup.options.filter((o) => !(onType(o) && o.questionCode === questionCode && o.value === value)),
    rules: setup.rules.filter(
      (r) => !(onType(r) && ((r.triggerQuestion === questionCode && lower(r.triggerAnswer) === lower(value)) || (r.targetQuestion === questionCode && lower(r.targetAnswer) === lower(value)))),
    ),
    defaultRules: setup.defaultRules.filter(
      (r) => !(onType(r) && ((r.triggerQuestion === questionCode && lower(r.triggerAnswer) === lower(value)) || (r.targetQuestion === questionCode && lower(r.value) === lower(value)))),
    ),
  };
}

export function moveOption(setup: SetupData, type: string, questionCode: string, value: string, dir: -1 | 1): SetupData {
  const mine = setup.options.filter((o) => o.signTypeCode === type && o.questionCode === questionCode).sort((a, b) => a.sortOrder - b.sortOrder);
  const i = mine.findIndex((o) => o.value === value);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= mine.length) return setup;
  const order = [...mine];
  [order[i], order[j]] = [order[j]!, order[i]!];
  const sortOf = new Map(order.map((o, n) => [o.value, (n + 1) * 10]));
  return {
    ...setup,
    options: setup.options.map((o) => (o.signTypeCode === type && o.questionCode === questionCode ? { ...o, sortOrder: sortOf.get(o.value) ?? o.sortOrder } : o)),
  };
}

// ---- Spec Rules (Shown when / Answers offered) -----------------------------------------

export function addRule(setup: SetupData, rule: Omit<SpecRule, "id">): SetupData {
  const dup = setup.rules.some(
    (r) =>
      r.signTypeCode === rule.signTypeCode && r.triggerQuestion === rule.triggerQuestion && lower(r.triggerAnswer) === lower(rule.triggerAnswer) &&
      r.targetQuestion === rule.targetQuestion && lower(r.targetAnswer) === lower(rule.targetAnswer),
  );
  return dup ? setup : { ...setup, rules: [...setup.rules, { ...rule, id: crypto.randomUUID() }] };
}

export function removeRule(setup: SetupData, id: string): SetupData {
  return { ...setup, rules: setup.rules.filter((r) => r.id !== id) };
}

/** Rule Matrix cell: does answer A of the trigger show the target question? */
export function setShowRule(setup: SetupData, type: string, trigger: string, answer: string, target: string, on: boolean): SetupData {
  if (on) return addRule(setup, { signTypeCode: type, triggerQuestion: trigger, triggerAnswer: answer, targetQuestion: target, targetAnswer: "" });
  return {
    ...setup,
    rules: setup.rules.filter(
      (r) => !(r.signTypeCode === type && r.triggerQuestion === trigger && lower(r.triggerAnswer) === lower(answer) && r.targetQuestion === target && r.targetAnswer === ""),
    ),
  };
}

// ---- Default rules ---------------------------------------------------------------------

export function addDefaultRule(setup: SetupData, rule: Omit<DefaultRule, "id">): SetupData {
  return { ...setup, defaultRules: [...setup.defaultRules, { ...rule, id: crypto.randomUUID() }] };
}

export function updateDefaultRule(setup: SetupData, id: string, patch: Partial<Omit<DefaultRule, "id" | "signTypeCode">>): SetupData {
  return { ...setup, defaultRules: setup.defaultRules.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

export function removeDefaultRule(setup: SetupData, id: string): SetupData {
  return { ...setup, defaultRules: setup.defaultRules.filter((r) => r.id !== id) };
}

/** Defaults Matrix cell: when Trigger = answer, Target defaults to value
 *  (blank value = no rule for that answer). */
export function setDefaultFor(setup: SetupData, type: string, trigger: string, answer: string, target: string, value: string): SetupData {
  const match = (r: DefaultRule) => r.signTypeCode === type && r.triggerQuestion === trigger && lower(r.triggerAnswer) === lower(answer) && r.targetQuestion === target;
  const rest = setup.defaultRules.filter((r) => !match(r));
  if (!value) return { ...setup, defaultRules: rest };
  const id = setup.defaultRules.find(match)?.id ?? crypto.randomUUID();
  return { ...setup, defaultRules: [...rest, { id, signTypeCode: type, triggerQuestion: trigger, triggerAnswer: answer, targetQuestion: target, value }] };
}

/** Sign types (besides `from`) that have both questions — where a set of
 *  defaults can be copied. */
export function typesWithBoth(setup: SetupData, from: string, trigger: string, target: string): string[] {
  const has = (t: string, c: string) => setup.questions.some((q) => q.signTypeCode === t && q.code === c);
  return setup.signTypes.filter((t) => t.code !== from && !t.isBlock && has(t.code, trigger) && has(t.code, target)).map((t) => t.code);
}

/** Copies one sign type's defaults for Trigger → Target to other sign types
 *  (replacing theirs for that pair). */
export function copyDefaults(setup: SetupData, from: string, trigger: string, target: string, to: string[]): SetupData {
  const src = setup.defaultRules.filter((r) => r.signTypeCode === from && r.triggerQuestion === trigger && r.targetQuestion === target);
  const toSet = new Set(to);
  const kept = setup.defaultRules.filter((r) => !(toSet.has(r.signTypeCode) && r.triggerQuestion === trigger && r.targetQuestion === target));
  const copies = to.flatMap((t) => src.map((r) => ({ ...r, id: crypto.randomUUID(), signTypeCode: t })));
  return { ...setup, defaultRules: [...kept, ...copies] };
}

// ---- Plain English ------------------------------------------------------------------------

const orList = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

/** "Always" / "When Pan depth is 2” or 3”" / "When Face type is answered" (+ also requires). */
export function shownWhen(idx: SetupIndex, q: Question): string {
  if (q.stage === "notAsked") return "Never asked (stage: Not asked)";
  let s = "Always";
  if (q.scope === "conditional") {
    const rules = idx.rulesTo(q.signTypeCode, q.code).filter((r) => r.targetAnswer === "");
    if (rules.length === 0) return "Never — no rule shows it";
    const byTrigger = new Map<string, string[]>();
    for (const r of rules) byTrigger.set(r.triggerQuestion, [...(byTrigger.get(r.triggerQuestion) ?? []), r.triggerAnswer]);
    s =
      "When " +
      [...byTrigger.entries()]
        .map(([code, answers]) => {
          const p = idx.question(q.signTypeCode, code)?.prompt ?? code;
          return answers.includes("") ? `${p} is answered` : `${p} is ${orList(answers)}`;
        })
        .join(", or ");
  }
  if (q.alsoRequiresQuestion) {
    const p = idx.question(q.signTypeCode, q.alsoRequiresQuestion)?.prompt ?? q.alsoRequiresQuestion;
    const v = q.alsoRequiresValues.trim();
    s += ` — and ${p} ${v.startsWith("!") ? `is not ${orList(v.slice(1).split("|"))}` : v ? `is ${orList(v.split("|"))}` : "is answered"}`;
  }
  return s;
}
