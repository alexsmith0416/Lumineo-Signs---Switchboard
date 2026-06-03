// The SignSpec form-state model. Mirrors the 31-field Sign Specifications
// Dataverse table that `Patch()` writes to on Save.
//
// All globals from the canvas plan map onto fields here.

import type { SignTypeCode } from "./signTypes";

export type Illumination = "" | "IL" | "EL" | "NI";
export type Faces = "" | "SF" | "DF" | "NA";
export type LEDColor = "WH" | "RD" | "BL" | "GR" | "RGB";
export type FaceTypeCode = "" | "AT" | "PT" | "RFPB" | "RFPT" | "DF" | "EM" | "CU";
export type FinishCode = "" | "P" | "RWB" | "RWM" | "OEM" | "CU";
export type VinylTypeCode = "" | "CV" | "DV" | "FX" | "NV";
export type MountingCode = "" | "WB" | "RB" | "FM" | "RM" | "FB" | "DM" | "RW" | "CU";
export type BackerType = "" | "FP" | "PT" | "CU";

export type SignSpecStatus = "Draft" | "Submitted" | "Approved" | "Built";

export type SignSpec = {
  // identity
  id?: string;
  productCode: string;
  status: SignSpecStatus;
  /** Sign Builder Pro-internal grouping (Preview-style). Sibling of the
      Project Scheduler `Job` concept — a SignSpec can live under both at
      once: the local Project keeps signs bundled for the build sheet,
      jobId links across to Project Scheduler when work is scheduled. */
  projectId?: string;
  /** Cross-sub-app lookup — Project Scheduler Job UUID. Set when the
      spec is launched with `?jobId=<id>` from Project Scheduler, or
      when an Ops user explicitly links the spec to a Job. */
  jobId?: string;
  /** Cross-sub-app lookup — Sales Hub Opportunity UUID. Set when Sales
      Hub launches Sign Builder Pro with `?opportunityId=<id>` to attach
      a fresh spec to an in-flight quote. */
  opportunityId?: string;
  /** Short human label — replaces "New Sign" when the user types one in. Independent of customerName/projectName. */
  name: string;

  // header inputs
  customerName: string;
  projectName: string;
  quantity: number;

  // step 1 / 1B
  signTypeCode: SignTypeCode | "";
  outsourced: boolean;

  // step 2
  faces: Faces;

  // step 3 — dimensions in inches
  heightIn: string;
  widthIn: string;
  depthIn: string;

  // step 4
  illumination: Illumination;

  // step 5
  ledColor: LEDColor;

  // step 6 / 6B — custom face / backer free-text active when codes are "CU"-style
  faceType: FaceTypeCode;
  faceTypeCustom: string;
  backerType: BackerType;
  backerTypeCustom: string;
  backerColor: string;

  // step 7
  finish: FinishCode;
  finishCustom: string;
  paintColor: string;

  // step 8
  vinyl: VinylTypeCode;
  vinylColor: string;
  vinylHex: string;
  digitalRef: string;

  // step 9
  mounting: MountingCode;
  mountingCustom: string;

  // steps 10/11/12 — MN/PS/PP only
  poleType: string;          // "New Pole" | "Existing Pole" | "No Pole"
  poleDiameter: string;
  poleMaterial: string;
  footingType: string;       // "New Footing / Excavation" | "Existing Footing"
  footingDepth: string;      // depth in inches
  footingMethod: string;
  electrical: string;        // "New Conduit Required" | "Existing Conduit" | "No Electrical"
  conduitSize: string;
  panelLocation: string;

  // approval (Ops only)
  approvedBy: string;        // user email of the Ops approver
  approvedAt: string;        // ISO timestamp

  // notes + routing
  notes: string;
  departments: string;
};

export function emptySignSpec(): SignSpec {
  return {
    productCode: "",
    status: "Draft",
    name: "",
    customerName: "",
    projectName: "",
    quantity: 1,
    signTypeCode: "",
    outsourced: false,
    faces: "",
    heightIn: "",
    widthIn: "",
    depthIn: "",
    illumination: "",
    ledColor: "WH",
    faceType: "",
    faceTypeCustom: "",
    backerType: "",
    backerTypeCustom: "",
    backerColor: "",
    finish: "",
    finishCustom: "",
    paintColor: "",
    vinyl: "",
    vinylColor: "",
    vinylHex: "",
    digitalRef: "",
    mounting: "",
    mountingCustom: "",
    poleType: "",
    poleDiameter: "",
    poleMaterial: "",
    footingType: "",
    footingDepth: "",
    footingMethod: "",
    electrical: "",
    conduitSize: "",
    panelLocation: "",
    approvedBy: "",
    approvedAt: "",
    notes: "",
    departments: "",
  };
}
