// Check Setup — finds setup mistakes before a salesperson does. A port of the
// BC extension's "LSB Setup Check" (same checks, same wording), plus one the
// app can do that BC couldn't: actually answering each sign type's Selected
// When from the category's first sign type to prove the type can be reached.
import type { Question, SetupData, SignType } from "../domain/types";
import { answerQuestion, evaluate, newSignLine } from "../engine/flow";
import { SetupIndex } from "../engine/setup-index";
import { isPendingValue } from "../engine/values";

export type IssueSeverity = "error" | "warning";

export interface SetupIssue {
  severity: IssueSeverity;
  categoryCode: string;
  signTypeCode: string;
  questionCode: string;
  text: string;
  fix: string;
}

const isList = (q: Question) => q.answerType === "option" || q.answerType === "yesno";

/** "LIT=Yes; WORK=New cabinet" → [["LIT","Yes"],["WORK","New cabinet"]] (raw parts kept for messages). */
export function parseSelectedWhen(selectedWhen: string): { part: string; code: string; values: string }[] {
  return selectedWhen
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf("=");
      return { part, code: eq < 1 ? "" : part.slice(0, eq).trim().toUpperCase(), values: eq < 1 ? "" : part.slice(eq + 1).trim() };
    });
}

export function checkSetup(setup: SetupData, only?: { categoryCode?: string; signTypeCode?: string }): SetupIssue[] {
  const idx = new SetupIndex(setup);
  const issues: SetupIssue[] = [];

  const optionExists = (typeCode: string, questionCode: string, value: string) =>
    !!idx.option(typeCode, questionCode, value) || isPendingValue(value);

  const add = (severity: IssueSeverity, t: SignType, questionCode: string, text: string, fix: string) =>
    issues.push({ severity, categoryCode: t.categoryCode, signTypeCode: t.code, questionCode, text, fix });

  // Typed answers are allowed on some questions, so a rule on an answer that
  // isn't in the list is only a warning there.
  const severityOf = (parent: Question): IssueSeverity => (parent.allowFreeText ? "warning" : "error");

  const checkSignType = (t: SignType) => {
    const questions = idx.questions(t.code);
    if (questions.length === 0) add("error", t, "", "The sign type has no questions.", "Add questions in the Decision Tree, or copy them from another sign type.");
    for (const q of questions) {
      // Spec Rules that show the question (and the answers they offer).
      if (q.scope === "conditional" && q.stage !== "notAsked" && !idx.hasQuestionRule(t.code, q.code)) {
        add("error", t, q.code, `"${q.prompt}" is Conditional but no rule shows it — it is never asked.`, "Tick it on the Rule Matrix of the answer that should bring it up, or set its Scope to Global.");
      }
      for (const rule of idx.rulesTo(t.code, q.code)) {
        const trigger = idx.question(t.code, rule.triggerQuestion);
        if (!trigger) {
          if (!t.isBlock) add("error", t, q.code, `A rule for "${q.prompt}" stands on question ${rule.triggerQuestion}, which this sign type doesn't have.`, "Remove the rule on the Rule Matrix, or paste the missing question.");
        } else {
          if (rule.triggerAnswer && isList(trigger) && !optionExists(t.code, trigger.code, rule.triggerAnswer)) {
            add(severityOf(trigger), t, q.code, `A rule for "${q.prompt}" stands on the answer "${rule.triggerAnswer}" of "${trigger.prompt}", which isn't one of its answers (renamed or removed?).`, `Fix it on the Rule Matrix of "${trigger.prompt}".`);
          }
          if (trigger.sortOrder >= q.sortOrder) {
            add("error", t, q.code, `"${q.prompt}" comes before "${trigger.prompt}", the question whose answer shows it.`, "Give it a higher Sort Order than the question it depends on.");
          }
        }
        if (rule.targetAnswer && !optionExists(t.code, q.code, rule.targetAnswer)) {
          add("warning", t, q.code, `A rule offers the answer "${rule.targetAnswer}" of "${q.prompt}", which isn't one of its answers.`, "Untick it on the Rule Matrix.");
        }
      }
      // APP: Default Rules.
      for (const rule of idx.defaultRulesTo(t.code, q.code)) {
        const trigger = idx.question(t.code, rule.triggerQuestion);
        if (!trigger) {
          add("error", t, q.code, `A default rule for "${q.prompt}" stands on question ${rule.triggerQuestion}, which this sign type doesn't have.`, "Remove or fix the default rule.");
        } else {
          if (rule.triggerAnswer && isList(trigger) && !optionExists(t.code, trigger.code, rule.triggerAnswer)) {
            add(severityOf(trigger), t, q.code, `A default rule for "${q.prompt}" stands on the answer "${rule.triggerAnswer}" of "${trigger.prompt}", which isn't one of its answers.`, "Fix the default rule.");
          }
          if (trigger.sortOrder >= q.sortOrder) {
            add("error", t, q.code, `"${q.prompt}" comes before "${trigger.prompt}", whose answer sets its default.`, "Give it a higher Sort Order than the question it depends on.");
          }
        }
        if (rule.value && isList(q) && !q.allowFreeText && !optionExists(t.code, q.code, rule.value)) {
          add("warning", t, q.code, `A default rule sets "${q.prompt}" to "${rule.value}", which isn't one of its answers.`, "Change the default rule or add it as an answer.");
        }
      }
      // "Also requires" (BC: And Show If).
      if (q.alsoRequiresQuestion && !t.isBlock) {
        const parent = idx.question(t.code, q.alsoRequiresQuestion);
        if (!parent) {
          add("error", t, q.code, `"${q.prompt}" depends on question ${q.alsoRequiresQuestion}, which this sign type doesn't have — it never shows.`, "Fix its Also requires, or paste the missing question.");
        } else {
          if (parent.sortOrder >= q.sortOrder) add("error", t, q.code, `"${q.prompt}" comes before "${parent.prompt}", the question it depends on.`, "Give it a higher Sort Order than the question it depends on.");
          if (isList(parent)) {
            const values = q.alsoRequiresValues.trim().replace(/^!/, "");
            for (const v of values.split("|").map((x) => x.trim()).filter(Boolean)) {
              if (!optionExists(t.code, parent.code, v)) {
                add(severityOf(parent), t, q.code, `"${q.prompt}" is shown for the answer "${v}" of "${parent.prompt}", which isn't one of its answers (renamed or removed?).`, `Fix its Also requires on "${parent.prompt}".`);
              }
            }
          }
        }
      }
      if (q.answerType === "option" && idx.options(t.code, q.code).length === 0 && !q.allowFreeText) {
        add("error", t, q.code, `"${q.prompt}" is a pick-list question with no answers to pick.`, "Add answers, or change the answer type to Text.");
      }
      if (q.defaultValue && isList(q) && !q.allowFreeText && !optionExists(t.code, q.code, q.defaultValue)) {
        add("warning", t, q.code, `The default of "${q.prompt}" (${q.defaultValue}) is not one of its answers.`, "Change the default or add it as an answer.");
      }
    }
    // Field Description template lines.
    for (const line of setup.templates.filter((x) => x.signTypeCode === t.code)) {
      if (line.conditionQuestion && !idx.question(t.code, line.conditionQuestion)) {
        add("warning", t, line.conditionQuestion, `A Field Description line depends on question ${line.conditionQuestion}, which this sign type doesn't have: "${line.text}"`, "Fix the line in the Field Description template.");
      }
      for (const m of line.text.matchAll(/\{(L?Q):([^}]*)\}/gi)) {
        const code = m[2]!.toUpperCase();
        if (!idx.question(t.code, code)) {
          add("warning", t, "", `A Field Description line uses {${m[1]!.toUpperCase()}:${code}}, a question this sign type doesn't have: "${line.text}"`, "Fix the line in the Field Description template (the line is skipped as it is).");
        }
      }
    }
    for (const rule of idx.referenceRules(t.code)) {
      if (rule.conditionQuestion && !idx.question(t.code, rule.conditionQuestion)) {
        add("warning", t, rule.conditionQuestion, `Spec reference rule for ${rule.referenceCode} depends on question ${rule.conditionQuestion}, which this sign type doesn't have.`, "Fix it in Spec Reference Rules.");
      }
    }
  };

  const checkSelectedWhen = (t: SignType) => {
    for (const p of parseSelectedWhen(t.selectedWhen)) {
      if (!p.code) {
        add("error", t, "", `Selected When part "${p.part}" isn't in the form QUESTION=answer.`, "Fix Selected When on Sign Types.");
        continue;
      }
      const q = idx.question(t.code, p.code);
      if (!q) {
        add("error", t, "", `Selected When uses question ${p.code}, which this sign type doesn't have.`, "Fix Selected When, or share the type-picking questions.");
        continue;
      }
      if (!q.picksSignType) {
        add("warning", t, q.code, `Selected When uses "${q.prompt}", which isn't marked Picks Sign Type — answering it won't switch the sign type.`, "Tick Picks Sign Type on the question and share the type-picking questions.");
      }
      if (!isList(q)) continue;
      for (const v of p.values.replace(/^!/, "").split("|").map((x) => x.trim()).filter(Boolean)) {
        if (!optionExists(t.code, q.code, v)) {
          add("error", t, q.code, `Selected When needs "${q.prompt}" = "${v}", which isn't one of its answers (renamed?).`, "Fix Selected When on Sign Types, or add the answer.");
        }
      }
    }
  };

  // Every type of a category should start with the same first questions.
  const optionsText = (typeCode: string, questionCode: string) =>
    idx.options(typeCode, questionCode).map((o) => o.value.toLowerCase()).join("|");
  const comparePickingQuestions = (first: SignType, t: SignType) => {
    const fix = "Open the sign type that is right and share its type-picking questions.";
    for (const fq of idx.questions(first.code).filter((q) => q.picksSignType)) {
      const oq = idx.question(t.code, fq.code);
      if (!oq) add("error", t, fq.code, `First question "${fq.prompt}" (on ${first.code}) is missing here.`, fix);
      else if (oq.prompt !== fq.prompt || optionsText(t.code, oq.code) !== optionsText(first.code, fq.code)) {
        add("error", t, fq.code, `First question "${fq.prompt}" differs from ${first.code} (wording or answers).`, fix);
      }
    }
    for (const oq of idx.questions(t.code).filter((q) => q.picksSignType)) {
      if (!idx.question(first.code, oq.code)) add("error", t, oq.code, `First question "${oq.prompt}" is only on some sign types of the category.`, fix);
    }
  };

  // APP: answer the Selected When from a brand-new sign in the category and
  // see which type it lands on — catches what the field-by-field checks miss.
  const checkReachable = (t: SignType) => {
    const want = new Map(parseSelectedWhen(t.selectedWhen).map((p) => [p.code, p.values.startsWith("!") ? "" : p.values.split("|")[0]!.trim()]));
    if ([...want.values()].some((v) => !v)) return; // "not" conditions — nothing single to answer
    let line = newSignLine(idx, "check", 10000, t.categoryCode, "full");
    try {
      for (let guard = 0; guard < 20; guard++) {
        const ev = evaluate(idx, line, "full");
        const q = idx
          .questions(line.signTypeCode)
          .find((x) => want.has(x.code) && ev.states[x.code]?.visible && ev.states[x.code]!.value.toLowerCase() !== want.get(x.code)!.toLowerCase());
        if (!q) break;
        line = answerQuestion(idx, line, "full", q.code, want.get(q.code)!).evaluation.line;
      }
    } catch (e) {
      add("error", t, "", `Answering its Selected When fails: ${e instanceof Error ? e.message : String(e)}`, "Fix Selected When on Sign Types, or add the answer to the first questions.");
      return;
    }
    if (line.signTypeCode !== t.code) {
      const landed = idx.signType(line.signTypeCode);
      add("error", t, "", `Answering its Selected When (${t.selectedWhen}) ends up on ${landed ? `${landed.code} – ${landed.description}` : line.signTypeCode}, not this sign type — nobody can pick it.`, "Make the Selected When of the two sign types different, or make sure every answer it needs is shown.");
    }
  };

  const categories = setup.categories.filter((c) => !only?.categoryCode || c.code === only.categoryCode);
  for (const c of categories) {
    if (!c.active) continue;
    const types = idx.typesOfCategory(c.code);
    if (types.length === 0) {
      if (!only?.signTypeCode) {
        issues.push({ severity: "error", categoryCode: c.code, signTypeCode: "", questionCode: "", text: "The category has no active sign types — users can't pick it.", fix: "Add a sign type (Duplicate is quickest) or deactivate the category." });
      }
      continue;
    }
    for (const t of types) {
      if (only?.signTypeCode && t.code !== only.signTypeCode) continue;
      checkSignType(t);
      if (types.length === 1) continue;
      if (!t.selectedWhen.trim()) {
        add("error", t, "", "This sign type has no Selected When, so the first questions can never pick it.", "Fill in Selected When on Sign Types, e.g. LIT=Yes; WORK=New cabinet.");
      } else {
        checkSelectedWhen(t);
        const same = types.find((o) => o.code !== t.code && o.selectedWhen.trim().toLowerCase() === t.selectedWhen.trim().toLowerCase());
        // On both types (BC listed it once): each one's editor should show it.
        if (same) {
          add("error", t, "", `Selected When is the same as ${same.code}, so only one of them can ever be picked.`, "Make the Selected When of the two sign types different.");
        }
        if (!same) checkReachable(t);
      }
      if (t.code !== types[0]!.code) comparePickingQuestions(types[0]!, t);
    }
  }
  // Blocks: their own questions only (they may lean on the using types' questions).
  if (!only?.categoryCode && !only?.signTypeCode) {
    for (const b of setup.signTypes.filter((x) => x.isBlock)) checkSignType(b);
  }
  return issues;
}
