// Fast lookups over the setup (built once per setup change).
import type {
  AnswerOption,
  Category,
  DefaultRule,
  Question,
  ReferenceRule,
  Section,
  SetupData,
  SignType,
  SpecReference,
  SpecRule,
  TemplateLine,
  OutputType,
} from "../domain/types";
import { isPendingValue } from "./values";

const key = (a: string, b: string) => `${a}\u0001${b}`;

export class SetupIndex {
  readonly data: SetupData;
  private typeMap = new Map<string, SignType>();
  private categoryMap = new Map<string, Category>();
  private questionMap = new Map<string, Question>();
  private questionsByType = new Map<string, Question[]>();
  private optionsByQuestion = new Map<string, AnswerOption[]>();
  private rulesByTarget = new Map<string, SpecRule[]>();
  private rulesByTrigger = new Map<string, SpecRule[]>();
  private defaultsByTarget = new Map<string, DefaultRule[]>();
  private referenceMap = new Map<string, SpecReference>();
  readonly sections: Section[];

  constructor(data: SetupData) {
    this.data = data;
    for (const t of data.signTypes) this.typeMap.set(t.code, t);
    for (const c of data.categories) this.categoryMap.set(c.code, c);
    for (const q of data.questions) {
      this.questionMap.set(key(q.signTypeCode, q.code), q);
      const list = this.questionsByType.get(q.signTypeCode) ?? [];
      list.push(q);
      this.questionsByType.set(q.signTypeCode, list);
    }
    for (const list of this.questionsByType.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    for (const o of data.options) {
      const k = key(o.signTypeCode, o.questionCode);
      const list = this.optionsByQuestion.get(k) ?? [];
      list.push(o);
      this.optionsByQuestion.set(k, list);
    }
    for (const list of this.optionsByQuestion.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const r of data.rules) {
      const kt = key(r.signTypeCode, r.targetQuestion);
      (this.rulesByTarget.get(kt) ?? this.rulesByTarget.set(kt, []).get(kt)!).push(r);
      const kg = key(r.signTypeCode, r.triggerQuestion);
      (this.rulesByTrigger.get(kg) ?? this.rulesByTrigger.set(kg, []).get(kg)!).push(r);
    }
    for (const r of data.defaultRules ?? []) {
      const k = key(r.signTypeCode, r.targetQuestion);
      (this.defaultsByTarget.get(k) ?? this.defaultsByTarget.set(k, []).get(k)!).push(r);
    }
    for (const ref of data.references) this.referenceMap.set(ref.code, ref);
    this.sections = [...data.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  signType(code: string): SignType | undefined {
    return this.typeMap.get(code);
  }
  category(code: string): Category | undefined {
    return this.categoryMap.get(code);
  }
  question(signTypeCode: string, code: string): Question | undefined {
    return this.questionMap.get(key(signTypeCode, code));
  }
  questions(signTypeCode: string): Question[] {
    return this.questionsByType.get(signTypeCode) ?? [];
  }
  /** The question's answers in order (Needs Survey / Open for design included). */
  options(signTypeCode: string, questionCode: string): AnswerOption[] {
    return this.optionsByQuestion.get(key(signTypeCode, questionCode)) ?? [];
  }
  /** The real answers (no Needs Survey / Open for design). */
  realOptions(signTypeCode: string, questionCode: string): AnswerOption[] {
    return this.options(signTypeCode, questionCode).filter((o) => !isPendingValue(o.value));
  }
  option(signTypeCode: string, questionCode: string, value: string): AnswerOption | undefined {
    const v = value.trim().toLowerCase();
    return this.options(signTypeCode, questionCode).find((o) => o.value.toLowerCase() === v);
  }
  rulesTo(signTypeCode: string, targetQuestion: string): SpecRule[] {
    return this.rulesByTarget.get(key(signTypeCode, targetQuestion)) ?? [];
  }
  rulesFrom(signTypeCode: string, triggerQuestion: string): SpecRule[] {
    return this.rulesByTrigger.get(key(signTypeCode, triggerQuestion)) ?? [];
  }
  /** Default rules for a question, in setup order (the first matching one wins). */
  defaultRulesTo(signTypeCode: string, targetQuestion: string): DefaultRule[] {
    return this.defaultsByTarget.get(key(signTypeCode, targetQuestion)) ?? [];
  }
  hasQuestionRule(signTypeCode: string, targetQuestion: string): boolean {
    return this.rulesTo(signTypeCode, targetQuestion).some((r) => r.targetAnswer === "");
  }
  templates(signTypeCode: string, outputType: OutputType): TemplateLine[] {
    return this.data.templates
      .filter((t) => t.signTypeCode === signTypeCode && t.outputType === outputType)
      .sort((a, b) => a.lineNo - b.lineNo);
  }
  referenceRules(signTypeCode: string): ReferenceRule[] {
    return this.data.referenceRules.filter((r) => r.signTypeCode === signTypeCode).sort((a, b) => a.lineNo - b.lineNo);
  }
  reference(code: string): SpecReference | undefined {
    return this.referenceMap.get(code);
  }
  /** Active categories in order. */
  activeCategories(): Category[] {
    return this.data.categories.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);
  }
  /** Active sign types of a category, in order (blocks excluded). */
  typesOfCategory(categoryCode: string): SignType[] {
    return this.data.signTypes
      .filter((t) => t.categoryCode === categoryCode && t.active && !t.isBlock)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  /** The type a new sign in the category starts as. */
  firstSignType(categoryCode: string): SignType | undefined {
    return this.typesOfCategory(categoryCode)[0];
  }
}
