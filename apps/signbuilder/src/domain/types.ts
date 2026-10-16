// Sign Builder domain model. Mirrors the Business Central extension's setup
// (LSB Sign Type, Spec Question, Spec Option, Spec Rule, Output Template Line…)
// so a BC "Export Setup (JSON)" file imports one-to-one, plus a few app-only
// additions (marked APP).

export type AnswerType = "option" | "text" | "number" | "dimension" | "yesno" | "vinyl";
export type Stage = "opportunity" | "job" | "later" | "notAsked";
export type Scope = "global" | "conditional";
export type DetailLevel = "opportunity" | "full";
export type OutputType = "production" | "field" | "extended";
export type SpecStatus = "draft" | "submitted" | "approved" | "built";
export type SpecPurpose = "opportunity" | "existingProject" | "walkIn";

export const SURVEY_VALUE = "Needs Survey";
export const OPEN_DESIGN_VALUE = "Open for design";

export interface Section {
  code: string;
  heading: string;
  sortOrder: number;
}

export interface Category {
  code: string;
  description: string;
  sortOrder: number;
  /** First part of every Spec Code in the category, e.g. CL. */
  codePrefix: string;
  active: boolean;
}

/** A sign type — or, with isBlock, a shared question block nobody picks. */
export interface SignType {
  code: string;
  description: string;
  /** How the type reads in generated text ({TYPE}). */
  outputName: string;
  sortOrder: number;
  active: boolean;
  categoryCode: string;
  variantName: string;
  /** Spec Code segment for the type, e.g. IL. */
  specCode: string;
  /** Answers that pick this type: "LIT=Yes; WORK=New cabinet". */
  selectedWhen: string;
  isBlock: boolean;
}

export interface Question {
  signTypeCode: string;
  code: string;
  sectionCode: string;
  sortOrder: number;
  prompt: string;
  /** Label printed in the Production Description. */
  outputLabel: string;
  answerType: AnswerType;
  required: boolean;
  defaultValue: string;
  allowFreeText: boolean;
  inProduction: boolean;
  /** "%1" = answer, "%2" = label, "\n" = new line, {QTY} {TYPE} {SIGN} {DESIGNREF} {JOB}. */
  productionFormat: string;
  productionSubNote: string;
  hint: string;
  unit: string;
  dimensionParts: number;
  dimensionLabels: string;
  vinylSeries: string;
  /** "Also requires" — the extra condition (BC: And Show If). */
  alsoRequiresQuestion: string;
  alsoRequiresValues: string;
  showWithPrevious: boolean;
  stage: Stage;
  allowSurvey: boolean;
  allowOpenForDesign: boolean;
  picksSignType: boolean;
  blockCode: string;
  scope: Scope;
}

export interface AnswerOption {
  signTypeCode: string;
  questionCode: string;
  value: string;
  sortOrder: number;
  hint: string;
  /** Extra words that pick this answer when typed ("first|1|front"). */
  alsoMatches: string;
  /** Spec Code segment added when chosen, e.g. DF. */
  codeSegment: string;
  /** APP: how this answer prints in the descriptions (blank = the answer itself). */
  outputText: string;
  /** APP: a whole Production line just for this answer (overrides the
   *  question's format; same placeholders). Blank = use the question's. */
  productionFormat: string;
  /** APP: the BC item (Item No., table 27) this answer's material is. Blank = none. */
  itemNo?: string;
}

/** APP: a BC item (Item table 27) in the categories Sign Builder links to —
 *  a snapshot until the BCSync_Items flow keeps it current. */
export interface BcItem {
  no: string;
  name: string;
  category: string;
  uom: string;
}

/** Show / Allow rule: when Trigger Question = Trigger Answer (blank = any),
 *  Target Question is asked; with Target Answer, that answer is offered. */
export interface SpecRule {
  id: string;
  signTypeCode: string;
  triggerQuestion: string;
  triggerAnswer: string;
  targetQuestion: string;
  targetAnswer: string;
}

/** APP: Default rule — when Trigger Question = Trigger Answer (blank = any
 *  answer), Target Question starts as Value instead of its own Default Value
 *  (e.g. Pan depth 2” → Face frame 2”x2” angle). Only fills in answers the
 *  person hasn't picked themselves; the first matching rule wins. */
export interface DefaultRule {
  id: string;
  signTypeCode: string;
  triggerQuestion: string;
  triggerAnswer: string;
  targetQuestion: string;
  value: string;
}

export interface TemplateLine {
  signTypeCode: string;
  outputType: OutputType;
  lineNo: number;
  text: string;
  conditionQuestion: string;
  conditionValues: string;
  andConditionQuestion: string;
  andConditionValues: string;
  newParagraph: boolean;
}

export interface BlockUsage {
  signTypeCode: string;
  blockCode: string;
  startSortOrder: number;
}

export interface SpecReference {
  code: string;
  description: string;
  fileName: string;
  sharePointUrl: string;
  /** Image data: URI or URL (loaded on demand in live mode). */
  thumbnail?: string;
  fullImage?: string;
}

export interface ReferenceRule {
  signTypeCode: string;
  lineNo: number;
  referenceCode: string;
  conditionQuestion: string;
  conditionValues: string;
  andConditionQuestion: string;
  andConditionValues: string;
}

export interface VinylColor {
  series: string;
  code: string;
  name: string;
  pantoneRef: string;
  family: string;
  notes: string;
  hex: string;
  sortOrder: number;
  /** APP: the BC item for this color (the 48" roll unless set otherwise). */
  itemNo?: string;
}

export interface ChecklistLine {
  lineNo: number;
  categoryCode: string;
  group: string;
  detail: string;
  inForm: string;
  stage: Stage;
  notes: string;
  questionCodes: string;
}

export interface SetupSettings {
  specReferenceFolderUrl: string;
  checkSpecsOnRelease: boolean;
  /** APP: print the BC part # after linked materials, e.g. "… Aluminum Angle (#20050)". */
  showPartNumbers?: boolean;
}

/** Everything that shapes the Sign Builder. */
export interface SetupData {
  sections: Section[];
  categories: Category[];
  signTypes: SignType[];
  questions: Question[];
  options: AnswerOption[];
  rules: SpecRule[];
  /** APP (not in BC). */
  defaultRules: DefaultRule[];
  templates: TemplateLine[];
  blockUsages: BlockUsage[];
  references: SpecReference[];
  referenceRules: ReferenceRule[];
  vinylColors: VinylColor[];
  /** APP: BC items (sign material categories) answers can link to. */
  items?: BcItem[];
  checklist: ChecklistLine[];
  settings: SetupSettings;
}

/** APP: a saved copy of the whole setup (Setup → Versions). */
export interface SetupVersion {
  id: string;
  label: string;
  note: string;
  /** Saved by hand, or automatically before an import / a restore. */
  kind: "manual" | "auto";
  createdAt: string;
  createdBy: string;
  stats: SetupStats;
}

export interface SetupStats {
  categories: number;
  signTypes: number;
  questions: number;
  answers: number;
  rules: number;
  templates: number;
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

/** What is stored for one answer. Everything else is worked out by the engine. */
export interface StoredAnswer {
  v: string;
  /** Sizes in inches (dimension questions). */
  s?: number[];
  /** Answered by a person (kept when the sign switches type). */
  u?: boolean;
  /** Was shown last time (so a default is filled in only when it first appears). */
  e?: boolean;
}

/** The engine's view of one question on one sign. */
export interface AnswerState {
  questionCode: string;
  value: string;
  sizes: number[];
  userEntered: boolean;
  /** Its rules pass (it applies). */
  eligible: boolean;
  /** Eligible, in scope for the detail level, and reached by the step logic. */
  visible: boolean;
  /** The question the form is waiting on. */
  nextStep: boolean;
  inScope: boolean;
  answered: boolean;
  /** Rules limit the answers offered here. */
  restricted: boolean;
  allowed: string[];
}

export interface SignLine {
  id: string;
  specId: string;
  lineNo: number;
  signName: string;
  categoryCode: string;
  signTypeCode: string;
  quantity: number;
  answers: Record<string, StoredAnswer>;
  /** Kept in step by the engine (stored for the Sign Library filters). */
  specCode: string;
  specReferenceCode: string;
  typeDecided: boolean;
  completedPct: number;
}

export interface Spec {
  id: string;
  number: string;
  description: string;
  purpose: SpecPurpose;
  status: SpecStatus;
  detailLevel: DetailLevel;
  opportunityNo: string;
  jobNo: string;
  projectId: string;
  customerNo: string;
  customerName: string;
  contactName: string;
  designReference: string;
  jobDetailNotes: string;
  createdAt: string;
  createdBy: string;
  modifiedAt: string;
  lastGeneratedAt: string;
  approvedBy: string;
  approvedAt: string;
}

// ---------------------------------------------------------------------------
// Business Central (read from Dataverse staging tables; written through flows)
// ---------------------------------------------------------------------------

/** A BC opportunity (crfdf_bcopportunity, filled by BCSync_SBOpportunities). */
export interface BcOpportunity {
  no: string;
  description: string;
  contactNo: string;
  contactName: string;
  companyName: string;
  salespersonCode: string;
  status: string;
  closed: boolean;
  creationDate: string;
  /** The BC project made from it ("" until then). */
  projectNo: string;
}

/** A BC project / job (Switchboard's crfdf_bcjob). */
export interface BcJob {
  no: string;
  name: string;
  customerName: string;
  description: string;
  salespersonCode: string;
  status: string;
}

/** A project's descriptions as BC has them now (Switchboard's crfdf_jobdesc, hourly). */
export interface JobDescriptions {
  jobNo: string;
  production: string;
  field: string;
  bcModified: string;
}

export type DescPushStatus = "pending" | "synced" | "failed";

/** Generate to Project: one write of descriptions to a BC project (crfdf_sbdescpush). */
export interface DescPush {
  id: string;
  jobNo: string;
  specId: string;
  sendProduction: boolean;
  sendField: boolean;
  status: DescPushStatus;
  message: string;
  createdAt: string;
  requestedBy: string;
}

export interface Project {
  id: string;
  name: string;
  customerName: string;
  notes: string;
  createdAt: string;
}
