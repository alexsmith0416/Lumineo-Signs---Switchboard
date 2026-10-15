// Reads the file from BC: Sign Builder Setup → Export Setup (JSON)
// (codeunit "LSB Setup Export"). Field names are BC's; enums are ordinals.
// A file exported before Spec Rules existed (old Show If rules) is converted
// the same way BC's LSB Rule Migration does.
import type {
  AnswerType,
  OutputType,
  Scope,
  SetupData,
  SpecRule,
  Stage,
} from "../domain/types";
import { conditionMet, isPendingValue } from "../engine/values";

type Row = Record<string, unknown>;

const ANSWER_TYPES: AnswerType[] = ["option", "text", "number", "dimension", "yesno", "vinyl"];
const STAGES: Stage[] = ["opportunity", "job", "later", "notAsked"];
const SCOPES: Scope[] = ["global", "conditional"];
const OUTPUT_TYPES: OutputType[] = ["production", "field", "extended"];

const str = (r: Row, k: string): string => (r[k] == null ? "" : String(r[k]));
const num = (r: Row, k: string): number => (r[k] == null || r[k] === "" ? 0 : Number(r[k]));
const bool = (r: Row, k: string): boolean => r[k] === true || r[k] === "true" || r[k] === 1;
const pick = <T,>(list: T[], r: Row, k: string, fallback: T): T => list[num(r, k)] ?? fallback;
const rows = (root: Row, k: string): Row[] => (Array.isArray(root[k]) ? (root[k] as Row[]) : []);

export interface ImportSummary {
  categories: number;
  signTypes: number;
  blocks: number;
  questions: number;
  rules: number;
  templates: number;
  references: number;
  convertedOldRules: number;
}

export function parseBcSetupExport(text: string): { setup: SetupData; summary: ImportSummary } {
  let root: Row;
  try {
    root = JSON.parse(text) as Row;
  } catch {
    throw new Error("This file isn't valid JSON. Use Sign Builder Setup → Export Setup (JSON) in Business Central.");
  }
  if (root.format !== "lumineo-signbuilder-setup") {
    throw new Error("This isn't a Sign Builder setup export from Business Central.");
  }

  const settingsRow = rows(root, "setup")[0] ?? {};
  const setup: SetupData = {
    sections: rows(root, "sections").map((r) => ({ code: str(r, "Code"), heading: str(r, "Heading"), sortOrder: num(r, "Sort Order") })),
    categories: rows(root, "categories").map((r) => ({
      code: str(r, "Code"),
      description: str(r, "Description"),
      sortOrder: num(r, "Sort Order"),
      codePrefix: str(r, "Code Prefix"),
      active: bool(r, "Active"),
    })),
    signTypes: rows(root, "signTypes").map((r) => ({
      code: str(r, "Code"),
      description: str(r, "Description"),
      outputName: str(r, "Output Name"),
      sortOrder: num(r, "Sort Order"),
      active: bool(r, "Active"),
      categoryCode: str(r, "Category Code"),
      variantName: str(r, "Variant Name"),
      specCode: str(r, "Spec Code"),
      selectedWhen: str(r, "Selected When"),
      isBlock: bool(r, "Is Block"),
    })),
    questions: rows(root, "questions").map((r) => ({
      signTypeCode: str(r, "Sign Type Code"),
      code: str(r, "Code"),
      sectionCode: str(r, "Section Code"),
      sortOrder: num(r, "Sort Order"),
      prompt: str(r, "Prompt"),
      outputLabel: str(r, "Output Label"),
      answerType: pick(ANSWER_TYPES, r, "Answer Type", "text"),
      required: bool(r, "Required"),
      defaultValue: str(r, "Default Value"),
      allowFreeText: bool(r, "Allow Free Text"),
      inProduction: bool(r, "In Production"),
      productionFormat: str(r, "Production Format"),
      productionSubNote: str(r, "Production Sub Note"),
      hint: str(r, "Hint"),
      unit: str(r, "Unit"),
      dimensionParts: num(r, "Dimension Parts") || 2,
      dimensionLabels: str(r, "Dimension Labels") || "Height|Width|Depth",
      vinylSeries: str(r, "Vinyl Series"),
      alsoRequiresQuestion: str(r, "And Show If Question"),
      alsoRequiresValues: str(r, "And Show If Values"),
      showWithPrevious: bool(r, "Show With Previous"),
      stage: pick(STAGES, r, "Stage", "job"),
      allowSurvey: bool(r, "Allow Survey"),
      allowOpenForDesign: bool(r, "Allow Open for Design"),
      picksSignType: bool(r, "Picks Sign Type"),
      blockCode: str(r, "Block Code"),
      scope: pick(SCOPES, r, "Scope", "global"),
    })),
    options: rows(root, "options").map((r) => ({
      signTypeCode: str(r, "Sign Type Code"),
      questionCode: str(r, "Question Code"),
      value: str(r, "Value"),
      sortOrder: num(r, "Sort Order"),
      hint: str(r, "Hint"),
      alsoMatches: str(r, "Also Matches"),
      codeSegment: str(r, "Code Segment"),
      outputText: "",
      productionFormat: "",
      itemNo: str(r, "Item No.") || undefined, // APP (fix script)
    })),
    rules: rows(root, "rules").map((r) => ({
      id: crypto.randomUUID(),
      signTypeCode: str(r, "Sign Type Code"),
      triggerQuestion: str(r, "Trigger Question Code"),
      triggerAnswer: str(r, "Trigger Answer"),
      targetQuestion: str(r, "Target Question Code"),
      targetAnswer: str(r, "Target Answer"),
    })),
    // APP rows (not exported by BC) — added by scripts/fix-bc-setup-export.mjs.
    defaultRules: rows(root, "defaultRules").map((r) => ({
      id: crypto.randomUUID(),
      signTypeCode: str(r, "Sign Type Code"),
      triggerQuestion: str(r, "Trigger Question Code"),
      triggerAnswer: str(r, "Trigger Answer"),
      targetQuestion: str(r, "Target Question Code"),
      value: str(r, "Default Value"),
    })),
    templates: rows(root, "templates").map((r) => ({
      signTypeCode: str(r, "Sign Type Code"),
      outputType: pick(OUTPUT_TYPES, r, "Output Type", "field"),
      lineNo: num(r, "Line No."),
      text: str(r, "Template Text"),
      conditionQuestion: str(r, "Condition Question"),
      conditionValues: str(r, "Condition Values"),
      andConditionQuestion: str(r, "And Condition Question"),
      andConditionValues: str(r, "And Condition Values"),
      newParagraph: bool(r, "New Paragraph"),
    })),
    blockUsages: rows(root, "blockUsages").map((r) => ({
      signTypeCode: str(r, "Sign Type Code"),
      blockCode: str(r, "Block Code"),
      startSortOrder: num(r, "Start Sort Order"),
    })),
    references: rows(root, "references").map((r) => ({
      code: str(r, "Code"),
      description: str(r, "Description"),
      fileName: str(r, "File Name"),
      sharePointUrl: str(r, "SharePoint URL"),
      thumbnail: str(r, "Thumbnail") || undefined,
      fullImage: str(r, "Full Image") || undefined,
    })),
    referenceRules: rows(root, "referenceRules").map((r) => ({
      signTypeCode: str(r, "Sign Type Code"),
      lineNo: num(r, "Line No."),
      referenceCode: str(r, "Reference Code"),
      conditionQuestion: str(r, "Condition Question"),
      conditionValues: str(r, "Condition Values"),
      andConditionQuestion: str(r, "And Condition Question"),
      andConditionValues: str(r, "And Condition Values"),
    })),
    vinylColors: rows(root, "vinylColors").map((r) => ({
      series: str(r, "Series"),
      code: str(r, "Code"),
      name: str(r, "Name"),
      pantoneRef: str(r, "Pantone Ref"),
      family: str(r, "Family"),
      notes: str(r, "Notes"),
      hex: str(r, "Hex"),
      sortOrder: num(r, "Sort Order"),
      itemNo: str(r, "Item No.") || undefined, // APP (fix script)
    })),
    // APP: BC item snapshot (fix script, from scripts/bc-items-probe.ps1).
    items: rows(root, "items").map((r) => ({
      no: str(r, "No."),
      name: str(r, "Description"),
      category: str(r, "Item Category Code"),
      uom: str(r, "Base Unit of Measure"),
    })),
    checklist: rows(root, "checklist").map((r) => ({
      lineNo: num(r, "Line No."),
      categoryCode: str(r, "Category Code"),
      group: str(r, "Group"),
      detail: str(r, "Detail"),
      inForm: str(r, "In Form"),
      stage: pick(STAGES, r, "Stage", "job"),
      notes: str(r, "Notes"),
      questionCodes: str(r, "Question Codes"),
    })),
    settings: {
      specReferenceFolderUrl: str(settingsRow, "Spec Reference Folder URL"),
      checkSpecsOnRelease: settingsRow["Check Specs on Release"] === undefined ? true : bool(settingsRow, "Check Specs on Release"),
      showPartNumbers: bool(settingsRow, "Show Part Numbers"),
    },
  };

  // Old show/hide rules (exported before Spec Rules) → rules.
  let converted = 0;
  for (const r of rows(root, "questions")) {
    const parent = str(r, "Show If Question");
    if (!parent) continue;
    const type = str(r, "Sign Type Code");
    const code = str(r, "Code");
    const q = setup.questions.find((x) => x.signTypeCode === type && x.code === code);
    if (!q) continue;
    q.scope = "conditional";
    converted++;
    for (const rule of convertOldRule(setup, type, parent, str(r, "Show If Values"), code)) {
      const dup = setup.rules.some(
        (x) => x.signTypeCode === type && x.triggerQuestion === rule.triggerQuestion && x.triggerAnswer === rule.triggerAnswer && x.targetQuestion === code && x.targetAnswer === "",
      );
      if (!dup) setup.rules.push(rule);
    }
  }

  return {
    setup,
    summary: {
      categories: setup.categories.length,
      signTypes: setup.signTypes.filter((t) => !t.isBlock).length,
      blocks: setup.signTypes.filter((t) => t.isBlock).length,
      questions: setup.questions.length,
      rules: setup.rules.length,
      templates: setup.templates.length,
      references: setup.references.length,
      convertedOldRules: converted,
    },
  };
}

function convertOldRule(setup: SetupData, type: string, parent: string, values: string, target: string): SpecRule[] {
  const rule = (answer: string): SpecRule => ({
    id: crypto.randomUUID(),
    signTypeCode: type,
    triggerQuestion: parent,
    triggerAnswer: answer,
    targetQuestion: target,
    targetAnswer: "",
  });
  const v = values.trim();
  if (v === "") return [rule("")];
  if (!v.startsWith("!")) return v.split("|").map((x) => x.trim()).filter(Boolean).map(rule);
  const parentQ = setup.questions.find((q) => q.signTypeCode === type && q.code === parent);
  if (!parentQ || !(parentQ.answerType === "option" || parentQ.answerType === "yesno")) return [rule("")];
  return setup.options
    .filter((o) => o.signTypeCode === type && o.questionCode === parent && !isPendingValue(o.value) && conditionMet(o.value, v))
    .map((o) => rule(o.value));
}
