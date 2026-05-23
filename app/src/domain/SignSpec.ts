// The SignSpec form-state model. Mirrors the 31-field Sign Specifications
// Dataverse table that `Patch()` writes to on Save.
//
// All globals from the canvas plan map onto fields here.

import type { SignTypeCode } from "./signTypes";

export type Illumination = "" | "IL" | "EL" | "NI";
export type Faces = "" | "SF" | "DF" | "NA";
export type LEDColor = "WH" | "RD" | "BL" | "GR" | "RGB";
export type FaceTypeCode = "" | "AT" | "PT" | "RFPB" | "RFPT" | "DF" | "EM";
export type FinishCode = "" | "P" | "RWB" | "RWM" | "OEM";
export type VinylTypeCode = "" | "CV" | "DV" | "FX" | "NV";
export type MountingCode = "" | "WB" | "RB" | "FM" | "RM" | "FB" | "DM" | "RW";
export type BackerType = "" | "FP" | "PT" | "CU";

export type SignSpecStatus = "Draft" | "Submitted" | "Approved" | "Built";

export type SignSpec = {
  // identity
  id?: string;
  productCode: string;
  status: SignSpecStatus;

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

  // step 6 / 6B
  faceType: FaceTypeCode;
  backerType: BackerType;
  backerColor: string;

  // step 7
  finish: FinishCode;
  paintColor: string;

  // step 8
  vinyl: VinylTypeCode;
  vinylColor: string;
  vinylHex: string;
  digitalRef: string;

  // step 9
  mounting: MountingCode;

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

  // notes + routing
  notes: string;
  departments: string;
};

export function emptySignSpec(): SignSpec {
  return {
    productCode: "",
    status: "Draft",
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
    backerType: "",
    backerColor: "",
    finish: "",
    paintColor: "",
    vinyl: "",
    vinylColor: "",
    vinylHex: "",
    digitalRef: "",
    mounting: "",
    poleType: "",
    poleDiameter: "",
    poleMaterial: "",
    footingType: "",
    footingDepth: "",
    footingMethod: "",
    electrical: "",
    conduitSize: "",
    panelLocation: "",
    notes: "",
    departments: "",
  };
}
