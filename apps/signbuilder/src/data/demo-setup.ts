// A small stand-in setup for local development (npm run dev) until the real
// one is imported from BC (Setup → Import from Business Central). It covers a
// Wall Cabinet category with two sign types picked by the first questions,
// Spec Rules, an answer-level rule, a survey answer and Field templates.
import type {
  AnswerOption,
  AnswerType,
  Question,
  SetupData,
  SpecRule,
  Stage,
  TemplateLine,
} from "../domain/types";

const questions: Question[] = [];
const options: AnswerOption[] = [];
const rules: SpecRule[] = [];
const templates: TemplateLine[] = [];

function q(
  type: string,
  code: string,
  section: string,
  sort: number,
  prompt: string,
  answerType: AnswerType,
  extra: Partial<Question> = {},
  answers: string[] = [],
): void {
  questions.push({
    signTypeCode: type,
    code,
    sectionCode: section,
    sortOrder: sort,
    prompt,
    outputLabel: prompt.replace(/\?$/, ""),
    answerType,
    required: true,
    defaultValue: "",
    allowFreeText: false,
    inProduction: true,
    productionFormat: "",
    productionSubNote: "",
    hint: "",
    unit: "",
    dimensionParts: 2,
    dimensionLabels: "Height|Width",
    vinylSeries: "",
    alsoRequiresQuestion: "",
    alsoRequiresValues: "",
    showWithPrevious: false,
    stage: "job" as Stage,
    allowSurvey: false,
    allowOpenForDesign: false,
    picksSignType: false,
    blockCode: "",
    scope: "global",
    ...extra,
  });
  const list = answerType === "yesno" && answers.length === 0 ? ["Yes", "No"] : answers;
  list.forEach((value, i) =>
    options.push({ signTypeCode: type, questionCode: code, value, sortOrder: (i + 1) * 10, hint: "", alsoMatches: "", codeSegment: "", outputText: "", productionFormat: "" }),
  );
}

function seg(type: string, question: string, segments: Record<string, string>): void {
  for (const o of options) if (o.signTypeCode === type && o.questionCode === question && segments[o.value]) o.codeSegment = segments[o.value]!;
}

function rule(type: string, trigger: string, answer: string, target: string, targetAnswer = ""): void {
  rules.push({ id: crypto.randomUUID(), signTypeCode: type, triggerQuestion: trigger, triggerAnswer: answer, targetQuestion: target, targetAnswer });
}

function t(type: string, lineNo: number, text: string, cond = "", values = "", newParagraph = false): void {
  templates.push({ signTypeCode: type, outputType: "field", lineNo, text, conditionQuestion: cond, conditionValues: values, andConditionQuestion: "", andConditionValues: "", newParagraph });
}

for (const type of ["WALL-CAB-LIT", "WALL-CAB-NI"]) {
  const lit = type === "WALL-CAB-LIT";
  // First questions (shared by both types; they pick the type).
  q(type, "QTY", "OVERVIEW", 1, "Quantity", "number", { defaultValue: "1", inProduction: false, stage: "opportunity", hint: "How many of this sign." });
  q(type, "LIT", "OVERVIEW", 2, "Lighted?", "yesno", { picksSignType: true, inProduction: false, stage: "opportunity" });
  q(type, "WORK", "OVERVIEW", 3, "New cabinet or new faces?", "option", { picksSignType: true, inProduction: false, stage: "opportunity" }, ["New cabinet", "New faces in an existing cabinet"]);

  q(type, "SCOPE", "OVERVIEW", 10, "Scope of work", "text", {
    defaultValue: lit ? "New I/I Wall Sign Cabinet" : "New Non-Illuminated Wall Sign Cabinet",
    productionFormat: "• SCOPE OF WORK: %1\\n• Qty: {QTY}",
    stage: "opportunity",
  });
  q(type, "IN_OUT", "OVERVIEW", 20, "Interior or exterior?", "option", { defaultValue: "Exterior", outputLabel: "Location", stage: "opportunity" }, ["Exterior", "Interior"]);
  seg(type, "IN_OUT", { Exterior: "EXT", Interior: "INT" });
  q(type, "SIDES", "OVERVIEW", 30, "Number of sides", "option", { defaultValue: "1 – Single Sided", outputLabel: "# of Sides", stage: "opportunity" }, ["1 – Single Sided", "2 – Double Sided"]);
  seg(type, "SIDES", { "1 – Single Sided": "SF", "2 – Double Sided": "DF" });
  q(type, "SIGN_SIZE", "OVERVIEW", 40, "Cabinet size", "dimension", { outputLabel: "Sign Size", stage: "opportunity" });
  q(type, "CAB_DEPTH", "OVERVIEW", 50, "Cabinet depth", "dimension", { defaultValue: lit ? "6”" : "4”", dimensionParts: 1, dimensionLabels: "Cabinet depth", showWithPrevious: true });
  if (lit) {
    q(type, "FACE_TYPE", "OVERVIEW", 60, "Face type", "option", { stage: "opportunity" }, ["Plex Face", "Routed & Backed", "Routed w/ Push Thru", "Flex Face"]);
    seg(type, "FACE_TYPE", { "Plex Face": "PX", "Routed & Backed": "RB", "Routed w/ Push Thru": "RP", "Flex Face": "FX" });
    q(type, "ROUTE_FACE", "ROUTING", 100, "Routed face material", "option", { scope: "conditional", outputLabel: "Face Material", defaultValue: ".125” Aluminum" }, [".125” Aluminum", ".090 Mil Aluminum"]);
    rule(type, "FACE_TYPE", "Routed & Backed", "ROUTE_FACE");
    rule(type, "FACE_TYPE", "Routed w/ Push Thru", "ROUTE_FACE");
    q(type, "BACKER", "ROUTING", 110, "Backer material", "option", { scope: "conditional", outputLabel: "Backer Material" }, [".177” White Plex", ".090 Mil Aluminum", "3mm ACM"]);
    rule(type, "FACE_TYPE", "Routed & Backed", "BACKER");
    rule(type, "FACE_TYPE", "Routed w/ Push Thru", "BACKER");
    // Push-thru needs a translucent backer: only plex is offered on that branch.
    rule(type, "FACE_TYPE", "Routed w/ Push Thru", "BACKER", ".177” White Plex");
    q(type, "FACE_PLEX", "ASSEMBLY", 300, "Face material", "option", { scope: "conditional", defaultValue: ".177” White Plex" }, [".177” White Plex", ".177” White Polycarbonate"]);
    rule(type, "FACE_TYPE", "Plex Face", "FACE_PLEX");
    q(type, "LIGHTING", "ASSEMBLY", 310, "Lighting", "option", { outputLabel: "Lighting Type", defaultValue: "White LED Modules", productionSubNote: "Applied internally to sign backer" }, ["White LED Modules", "RGB LED Modules"]);
  } else {
    q(type, "FACE_MAT", "OVERVIEW", 60, "Face material", "option", { defaultValue: ".090 Mil Aluminum", stage: "opportunity" }, [".090 Mil Aluminum", ".125” Aluminum", "3mm ACM"]);
  }
  q(type, "MOUNTING", "OVERVIEW", 70, "Mounting", "option", { outputLabel: "Mounting Type", stage: "opportunity" }, ["Flush to wall", "1-1/2” Stand Offs / Spacers", "Projecting – plate mounted"]);
  seg(type, "MOUNTING", { "Flush to wall": "FM", "1-1/2” Stand Offs / Spacers": "SO", "Projecting – plate mounted": "PJ" });
  q(type, "PAINT_COLOR", "PAINT", 200, "Paint color", "text", { outputLabel: "Color", hint: "PMS or Matthews color." });
  q(type, "INSTALL_BY", "INSTALL", 500, "Installed by", "option", { inProduction: false, defaultValue: "Lumineo", stage: "opportunity" }, ["Lumineo", "Customer", "Subcontractor"]);
  q(type, "WALL_TYPE", "INSTALL", 510, "Wall type", "option", { inProduction: false, scope: "conditional", allowSurvey: true, stage: "opportunity" }, ["Brick", "Block", "EIFS", "Metal", "Wood", "Needs Survey"]);
  rule(type, "INSTALL_BY", "Lumineo", "WALL_TYPE");
  rule(type, "INSTALL_BY", "Subcontractor", "WALL_TYPE");
  if (lit) {
    q(type, "ELEC", "INSTALL", 520, "Electrical", "option", { inProduction: false, scope: "conditional", allowSurvey: true, stage: "opportunity" }, ["Existing at sign location", "New – by customer's electrician", "Needs Survey"]);
    rule(type, "INSTALL_BY", "Lumineo", "ELEC");
    rule(type, "INSTALL_BY", "Subcontractor", "ELEC");
  }
  q(type, "PERMIT", "INSTALL", 530, "Permit", "option", { inProduction: false, stage: "opportunity" }, ["Lumineo to secure – invoiced at cost", "Customer to secure", "Not required"]);

  t(type, 10000, "Installation by customer.", "INSTALL_BY", "Customer", true);
  t(type, 20000, "Install ({QTY}) new {TYPE}, {Q:SIGN_SIZE}.", "INSTALL_BY", "!Customer", true);
  t(type, 30000, "Mount {LQ:MOUNTING} to {LQ:WALL_TYPE} wall.");
  if (lit) t(type, 40000, "Connect to {LQ:ELEC} power.");
  t(type, 50000, "Permit: {Q:PERMIT}.");
}

export const DEMO_SETUP: SetupData = {
  sections: [
    { code: "OVERVIEW", heading: "SIGN OVERVIEW", sortOrder: 10 },
    { code: "ROUTING", heading: "ROUTING", sortOrder: 20 },
    { code: "FABRICATION", heading: "FABRICATION", sortOrder: 30 },
    { code: "PAINT", heading: "PAINT", sortOrder: 40 },
    { code: "VINYL", heading: "VINYL & GRAPHICS", sortOrder: 50 },
    { code: "ASSEMBLY", heading: "ASSEMBLY", sortOrder: 60 },
    { code: "INSTALL", heading: "INSTALL OVERVIEW", sortOrder: 70 },
  ],
  categories: [{ code: "WALLCAB", description: "Wall Cabinet", sortOrder: 30, codePrefix: "WC", active: true }],
  signTypes: [
    { code: "WALL-CAB-LIT", description: "Wall Sign Cabinet – Lighted", outputName: "I/I wall sign cabinet", sortOrder: 40, active: true, categoryCode: "WALLCAB", variantName: "Lighted cabinet", specCode: "IL", selectedWhen: "LIT=Yes; WORK=New cabinet", isBlock: false },
    { code: "WALL-CAB-NI", description: "Wall Sign Cabinet – Non-Lighted", outputName: "N/I wall sign cabinet", sortOrder: 41, active: true, categoryCode: "WALLCAB", variantName: "Non-lighted cabinet", specCode: "NI", selectedWhen: "LIT=No; WORK=New cabinet", isBlock: false },
  ],
  questions,
  options,
  rules,
  templates,
  blockUsages: [],
  references: [],
  referenceRules: [],
  vinylColors: [],
  checklist: [],
  settings: {
    specReferenceFolderUrl: "https://luminousneon.sharepoint.com/:f:/s/installationschedule/IgCICY5o8mlOT7c8fCvX5reKAUAU8IBC97OAv05zbg9C2WI?e=ac3S51",
    checkSpecsOnRelease: true,
  },
};
