// Real-time product-code assembly.
//
// Code shape:
//   {SignTypeCode}-{Faces}-{Illum}-{FaceType}-{Finish}-{Vinyl}-{Mounting}-{LED}
//
// Rules:
//   - LED is only included when illumination is IL or EL.
//   - Empty segments are skipped, so a partially-filled spec still produces
//     a valid prefix (e.g. "WC-DF-IL").
//   - With no sign type selected the code is empty.

import type { SignSpec } from "./SignSpec";

export function assembleProductCode(spec: SignSpec): string {
  if (!spec.signTypeCode) return "";

  const segments: string[] = [
    spec.signTypeCode,
    spec.faces,
    spec.illumination,
    spec.faceType,
    spec.finish,
    spec.vinyl,
    spec.mounting,
  ];

  if (spec.illumination === "IL" || spec.illumination === "EL") {
    segments.push(spec.ledColor);
  }

  return segments.filter((s) => s && s.length > 0).join("-");
}

// Department routing — collapses the spec into the comma-separated string that
// the canvas plan's lblDeptCalc produces. Same gating rules as the spec.
export function calculateDepartments(spec: SignSpec): string {
  const depts: string[] = [];
  const t = spec.signTypeCode;
  if (!t) return "";

  if (t === "MN" || t === "PS" || t === "PP") depts.push("Grounding");

  // Metal fabrication: cabinet builds done in-house (i.e. not outsourced letters)
  if ((t === "WC" || t === "MN" || t === "PS" || t === "PP" || t === "AP" || t === "EP" || t === "EM") && !spec.outsourced) {
    depts.push("Metal Fabrication");
  }

  // Paint: only when the finish is Shop Painted ("P")
  if (spec.finish === "P") depts.push("Paint");

  // Vinyl: any vinyl/graphic application
  if (spec.vinyl && spec.vinyl !== "NV") depts.push("Vinyl");

  // Assembly: every sign goes through final assembly
  depts.push("Assembly");

  return depts.join(", ");
}
