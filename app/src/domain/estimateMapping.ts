// Maps a Sign Builder Pro `SignSpec` into the canonical `Piece` shape the
// Estimating app's calc engine consumes.
//
// Source of truth — Estimating repo, branch `claude/estimating-app`:
//   * Piece + PieceInputs types: apps/estimating/src/lib/engine.ts
//   * Piece type registry + input keys per type:
//       apps/estimating/src/data/pieceTypes.ts
//
// Two things this file owns:
//   1) typeId mapping  — which Estimating piece-type slug to emit per
//      (SBP signTypeCode, faces, faceType) combination.
//   2) input shaping   — every Estimating piece type has its OWN input
//      key vocabulary (H/L/D, qty, faces, surface, inchesOfCopy, shape,
//      etc.). We emit each piece's `inputs` map using exactly the keys
//      that piece type's `compute()` reads.

import type { SignSpec } from "./SignSpec";

/** Canonical piece-type IDs from the Estimating registry (PIECE_TYPES in
    apps/estimating/src/data/pieceTypes.ts). Adding a new SBP→Estimating
    mapping starts here. */
export type PieceTypeId =
  | "freeform-tm"
  | "apply-vinyl-graphics"
  | "vinyl-cutting"
  | "paint-calculation"
  | "routed-panel-shapes"
  | "alum-pan-sign"
  | "economy-pan-sign"
  | "post-and-panel"
  | "flat-panels"
  | "routed-face-only"
  | "routed-alum-faces-letters"
  | "routed-push-through-acrylic"
  | "sf-routed-cabinet"
  | "df-routed-cabinet"
  | "sf-acrylic-cabinet"
  | "economy-sf-acrylic"
  | "df-acrylic-cabinet"
  | "sf-flex-cabinet"
  | "df-flex-cabinet"
  | "pole-cover"
  | "structural-steel"
  | "emc-assembly"
  | "led-wiring"
  | "trimcap-letter-face"
  | "channel-letter-fabrication";

/** Piece-shape Estimating expects on import. Mirrors `Piece` from
    apps/estimating/src/lib/engine.ts (its readonly modifiers dropped so
    the payload JSON round-trips cleanly). */
export type EstimatingPieceDraft = {
  /** Piece-type slug Estimating looks up via `getPieceType(typeId)`. */
  typeId: PieceTypeId;
  /** User-visible label that lands on the piece. Free-form. */
  label?: string;
  /** Inputs the piece type's compute() function reads. Key names vary per
      type — see `apps/estimating/src/data/pieceTypes.ts` for each. All
      dimensions are inches as NUMBERS (Estimating's `num()` helper). */
  inputs: Record<string, number | string>;
  /** Optional pre-filled material lines (e.g. the picked vinyl color).
      itemNo can be a hint — Estimating resolves to the catalog item. */
  extraMaterials?: Array<{
    itemNo: string;
    units: number;
    description?: string;
  }>;
  /** Optional pre-filled labor lines. Rare from the SBP side — usually
      Estimating's compute() generates these. */
  extraLabor?: Array<{
    workCode: number;
    hours: number;
    description?: string;
  }>;
};

/**
 * Map a SignSpec → one or more `Piece` drafts. The Estimating app calls
 * its own `getPieceType(typeId)` per draft and creates a row in the
 * project's pieces list.
 *
 * One SBP sign produces a primary piece (the sign itself) plus additional
 * pieces for graphics, paint, LED, and ground-mount infrastructure. Order
 * roughly mirrors fabrication sequence.
 */
export function mapSpecToEstimatePieces(spec: SignSpec): EstimatingPieceDraft[] {
  const pieces: EstimatingPieceDraft[] = [];

  const primary = primaryPiece(spec);
  if (primary) pieces.push(primary);

  // Front-lit / combo channel letters get the trim-cap face as an
  // additional piece (the fabrication piece covers the letter shell).
  if (spec.signTypeCode === "FL" || spec.signTypeCode === "CL") {
    pieces.push({
      typeId: "trimcap-letter-face",
      label: "Trim-cap letter face",
      inputs: {
        // The trimcap piece type measures perimeter inches × qty; SBP
        // doesn't capture that, so seed inches from H+L as a rough
        // perimeter estimate and let the estimator refine.
        inches: roughLetterPerimeter(spec),
        qty: Math.max(1, spec.quantity),
      },
    });
  }

  // LED wiring — for illuminated cabinet / pan signs (channel letters
  // bundle LED in their fab piece).
  if (
    (spec.illumination === "IL" || spec.illumination === "EL") &&
    !isLetters(spec)
  ) {
    pieces.push({
      typeId: "led-wiring",
      label: `LED wiring (${spec.ledColor})`,
      inputs: {
        H: dimNumber(spec.heightIn),
        L: dimNumber(spec.widthIn),
        qty: Math.max(1, spec.quantity),
        ledFamily: "synergy", // sensible default — estimator can flip
      },
    });
  }

  // Vinyl — cutting + apply are separate pieces in the workbook + engine.
  // CV (Cut Vinyl) needs both; DV (Digital print) and FX (Wrap) just
  // apply. NV (No vinyl) skips.
  if (spec.vinyl === "CV") {
    pieces.push({
      typeId: "vinyl-cutting",
      label: spec.vinylColor || "Vinyl cutting",
      inputs: {
        H: dimNumber(spec.heightIn),
        L: dimNumber(spec.widthIn),
        qty: Math.max(1, spec.quantity),
      },
      extraMaterials: spec.vinylColor
        ? [{ itemNo: vinylSearchHint(spec.vinylColor), units: 0, description: spec.vinylColor }]
        : undefined,
    });
    pieces.push({
      typeId: "apply-vinyl-graphics",
      label: "Apply vinyl",
      inputs: {
        H: dimNumber(spec.heightIn),
        L: dimNumber(spec.widthIn),
        qty: Math.max(1, spec.quantity),
        surface: spec.faceType === "RFPT" ? "push-through" : "flat",
      },
    });
  } else if (spec.vinyl === "DV" || spec.vinyl === "FX") {
    pieces.push({
      typeId: "apply-vinyl-graphics",
      label: spec.vinyl === "DV" ? "Apply digital print" : "Apply wrap film",
      inputs: {
        H: dimNumber(spec.heightIn),
        L: dimNumber(spec.widthIn),
        qty: Math.max(1, spec.quantity),
        surface: spec.faceType === "RFPT" ? "push-through" : "flat",
      },
    });
  }

  // Paint — only when finish is Shop Painted. Faces input maps to SBP's
  // SF / DF / NA selector (1 for SF + NA, 2 for DF).
  if (spec.finish === "P") {
    pieces.push({
      typeId: "paint-calculation",
      label: spec.paintColor ? `Paint — ${spec.paintColor}` : "Paint",
      inputs: {
        H: dimNumber(spec.heightIn),
        L: dimNumber(spec.widthIn),
        faces: spec.faces === "DF" ? 2 : 1,
      },
    });
  }

  // Ground-mount cabinets (MN / PS) — add Pole Cover + Structural Steel
  // when a new pole + footing are being installed.
  if ((spec.signTypeCode === "MN" || spec.signTypeCode === "PS") && spec.poleType === "New Pole") {
    pieces.push({
      typeId: "pole-cover",
      label: [spec.poleMaterial, spec.poleDiameter].filter(Boolean).join(" · ") || "Pole cover",
      inputs: {
        shape: "Rectangular",
        extraColors: 0,
        qty: 1,
        H: dimNumber(spec.heightIn),
        L: dimNumber(spec.poleDiameter) || dimNumber(spec.widthIn),
        D: 0,
      },
    });
    pieces.push({
      typeId: "structural-steel",
      label: spec.footingMethod || "Structural steel",
      inputs: {
        description: [spec.footingType, spec.footingMethod].filter(Boolean).join(" · "),
        // Structural Steel is a freeform hours field; estimator fills in.
        hours: 0,
      },
    });
  }

  return pieces;
}

// ─── Primary-piece routing ────────────────────────────────────────────────

function primaryPiece(spec: SignSpec): EstimatingPieceDraft | null {
  const t = spec.signTypeCode;
  if (!t) return null;
  const df = spec.faces === "DF";
  const H = dimNumber(spec.heightIn);
  const L = dimNumber(spec.widthIn);
  const D = dimNumber(spec.depthIn);
  const qty = Math.max(1, spec.quantity);

  // Cabinets (WC / MN / PS) — face type drives the variant.
  if (t === "WC" || t === "MN" || t === "PS") {
    // Routed cabinet (AT / RFPB / RFPT).
    if (spec.faceType === "AT" || spec.faceType === "RFPB" || spec.faceType === "RFPT") {
      const typeId: PieceTypeId = df ? "df-routed-cabinet" : "sf-routed-cabinet";
      return {
        typeId,
        label: cabinetLabel(spec),
        inputs: {
          shape: "Rectangular",
          extraColors: 0,
          qty,
          H, L, D: D || 6,
          inchesOfCopy: 0,
          pushThrough: spec.faceType === "RFPT" ? "Yes" : "No",
        },
      };
    }
    // Plex face → acrylic cabinet.
    if (spec.faceType === "PT") {
      return {
        typeId: df ? "df-acrylic-cabinet" : "sf-acrylic-cabinet",
        label: cabinetLabel(spec),
        inputs: { shape: "Rectangular", extraColors: 0, qty, H, L, D: D || 6, dividerRows: 0 },
      };
    }
    // Direct print / flex face.
    if (spec.faceType === "DF") {
      return {
        typeId: df ? "df-flex-cabinet" : "sf-flex-cabinet",
        label: cabinetLabel(spec),
        inputs: { shape: "Rectangular", extraColors: 0, qty, H, L, D: D || 6 },
      };
    }
    // Non-illuminated, no specific face type yet — fall through to a
    // freeform piece so the estimator can pick the right cabinet type.
    return {
      typeId: "freeform-tm",
      label: cabinetLabel(spec),
      inputs: { description: cabinetLabel(spec) },
    };
  }

  // Post & panel
  if (t === "PP") {
    return {
      typeId: "post-and-panel",
      label: "Post & panel",
      inputs: {
        shape: "Rectangular",
        extraColors: 0,
        qty,
        H, L, D: D || 3,
        postCount: 0,
        postLen: 0,
      },
    };
  }

  // Pan signs — SBP splits Aluminum (AP) vs Economy (EP); Estimating
  // has two separate piece types for the same split.
  if (t === "AP") {
    return {
      typeId: "alum-pan-sign",
      label: "Aluminum pan sign",
      inputs: {
        shape: "Rectangular",
        extraColors: 0,
        qty,
        H, L, D: D || 2,
      },
    };
  }
  if (t === "EP") {
    return {
      typeId: "economy-pan-sign",
      label: "Economy pan sign",
      inputs: { qty, H, L, D: D || 2 },
    };
  }

  // Channel letters — fabrication piece. Trim-cap face piece is added
  // separately for front-lit / combo letters in the caller.
  if (t === "FL" || t === "HL" || t === "CL") {
    const face = "block"; // SBP doesn't capture typeface; default to block, estimator can flip
    const letterLabel =
      t === "FL" ? "Front-lit channel letters" :
      t === "HL" ? "Halo-lit channel letters" : "Combo-lit channel letters";
    return {
      typeId: "channel-letter-fabrication",
      label: letterLabel,
      inputs: {
        inches: roughLetterPerimeter(spec),
        qty,
        face,
      },
    };
  }

  // FCO aluminum letters → routed-alum-faces-letters
  if (t === "AL") {
    return {
      typeId: "routed-alum-faces-letters",
      label: "FCO aluminum letters",
      inputs: { H, L, qty, inchesOfCopy: roughLetterPerimeter(spec) },
    };
  }

  // FCO acrylic letters → routed-push-through-acrylic (closest match in the
  // current piece-type library; estimator can swap if needed).
  if (t === "AC") {
    return {
      typeId: "routed-push-through-acrylic",
      label: "FCO acrylic letters",
      inputs: { H, L, qty, inchesOfCopy: roughLetterPerimeter(spec) },
    };
  }

  // Cast Aluminum (CA) + Formed Plastic (PL) — no exact piece type in
  // the Estimating registry today. Land as freeform with a descriptive
  // label so the estimator picks the right approach (or someone adds
  // dedicated piece types later).
  if (t === "CA") {
    return {
      typeId: "freeform-tm",
      label: "Cast aluminum letters",
      inputs: { description: "Cast aluminum letters — pick piece type or enter as time & material" },
    };
  }
  if (t === "PL") {
    return {
      typeId: "freeform-tm",
      label: "Formed plastic letters",
      inputs: { description: "Formed plastic letters — pick piece type or enter as time & material" },
    };
  }

  // EMC
  if (t === "EM") {
    return {
      typeId: "emc-assembly",
      label: "EMC assembly",
      inputs: { H, L, qty, pitch: 0 },
    };
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function dimNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function cabinetLabel(spec: SignSpec): string {
  const t = spec.signTypeCode;
  const baseName =
    t === "WC" ? "Wall sign" :
    t === "MN" ? "Monument sign" :
    t === "PS" ? "Pole sign" : "Cabinet";
  return spec.faces === "DF" ? `Double-face ${baseName.toLowerCase()}` : `Single-face ${baseName.toLowerCase()}`;
}

function isLetters(spec: SignSpec): boolean {
  return ["FL", "HL", "CL", "AL", "CA", "PL", "AC"].includes(spec.signTypeCode);
}

/** Rough perimeter inches for a letter set — used to seed the
    `inches` input on channel-letter-fabrication / trim-cap-face when
    SBP doesn't capture letter-level dimensions. The estimator refines.
    Falls back to 0 if SBP has no dimensions yet. */
function roughLetterPerimeter(spec: SignSpec): number {
  const h = dimNumber(spec.heightIn);
  const l = dimNumber(spec.widthIn);
  if (!h || !l) return 0;
  return (h + l) * 2;
}

/** The Estimating catalog has hundreds of vinyl SKUs (3M 3630-### etc).
    We can't reliably map SBP's display string ("3M 3630 — 022 Black") to
    an exact itemNo from here, so the description doubles as a search
    hint for Estimating's catalog picker. */
function vinylSearchHint(vinylColor: string): string {
  return vinylColor;
}
