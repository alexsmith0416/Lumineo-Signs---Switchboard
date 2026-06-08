// Maps a Sign Builder Pro `SignSpec` into the Estimating app's piece-type
// model (per the Linear project "Estimating — Power Apps Code App",
// issue ALE-244). The Estimating app expects each sign to land as one or
// more `lum_estimatepiece` rows, each with a piece type drawn from the
// estimating workbook sheets (~25 types). This file owns the canonical
// translation table.
//
// The piece names below MUST match the sheet names in the source workbook
// `reference/estimating/Sign365_LN_Estimate_Template_-_Blank.xlsx` so the
// Estimating app can pick up the right cascade.

import type { SignSpec } from "./SignSpec";

export type EstimatingPieceType =
  | "Apply Vinyl Graphics"
  | "Vinyl Cutting"
  | "Paint Calculation"
  | "Sf Routed Cabinet"
  | "Df Routed Cabinet"
  | "Sf Acrylic Cabinet"
  | "Df Acrylic Cabinet"
  | "Economy Acrylic Cabinet"
  | "Sf Flex Cabinet"
  | "Df Flex Cabinet"
  | "Alum/Economy Pan"
  | "Post & Panel"
  | "Pole Cover"
  | "Structural Steel"
  | "Channel Letter Fabrication"
  | "Trimcap Letter Face"
  | "Routed Alum Faces Letters"
  | "Routed Push-Through Acrylic"
  | "Cast Aluminum Letters"
  | "Formed Plastic Letters"
  | "FCO Acrylic Letters"
  | "EMC Assembly"
  | "LED Wiring";

export type EstimatingPieceDraft = {
  /** Sheet-name piece type the Estimating engine will load. */
  pieceType: EstimatingPieceType;
  /** Quantity of this piece (a single SBP spec maps to one cabinet at qty 1
      unless the spec itself carries quantity > 1). */
  qty: number;
  /** Height in inches. Empty string when not applicable for this piece. */
  heightIn: string;
  /** Length / width in inches. */
  lengthIn: string;
  /** Optional depth — only used by cabinet pieces. */
  depthIn?: string;
  /** Surface / option key (e.g. "Routed Face Push-Through"). Free-form per
      piece type; matches the "options" column on the workbook sheet. */
  options?: string;
  /** Pre-populated material lines — usually one (e.g. the vinyl color).
      Estimating will resolve the BC item number from the catalog at
      import time using `materialHint`. */
  materialHints?: MaterialHint[];
  /** Notes that should land on the piece — paint color, vinyl reference,
      mounting details, etc. Free-form. */
  notes?: string;
};

export type MaterialHint = {
  /** Description the catalog picker should pre-search for. Estimating
      treats this as a best-effort hint, not an exact item match. */
  description: string;
  /** Pre-filled units (typically sqft computed from the spec). Estimating
      may recompute from the piece sqft at import. */
  units?: number;
  /** Optional category tag for grouping in the picker UI. */
  category?: "Vinyl" | "Paint" | "Substrate" | "Hardware" | "Electrical";
};

/**
 * Map a fully-saved SignSpec to one or more Estimating piece drafts.
 *
 * One SBP sign can produce multiple Estimating pieces — e.g. a routed
 * cabinet ALSO requires a Paint Calculation piece if it's shop-painted,
 * plus an Apply Vinyl Graphics piece if vinyl was specified, plus a Pole
 * Cover piece if it's a Monument or Pole Sign with a new pole. Order in
 * the returned array roughly mirrors fabrication order.
 */
export function mapSpecToEstimatePieces(spec: SignSpec): EstimatingPieceDraft[] {
  const pieces: EstimatingPieceDraft[] = [];

  const primary = primaryPiece(spec);
  if (primary) pieces.push(primary);

  // Channel letters get the trim-cap face piece + LED wiring as additional
  // pieces (the fabrication piece already covers the letter shell).
  if (isFrontLit(spec)) {
    pieces.push({
      pieceType: "Trimcap Letter Face",
      qty: spec.quantity,
      heightIn: spec.heightIn,
      lengthIn: spec.widthIn,
    });
  }

  // LED wiring shows up whenever the sign is internally / externally lit
  // and we didn't already roll it into a Channel Letter piece (since CL
  // pieces have LED bundled).
  if ((spec.illumination === "IL" || spec.illumination === "EL") && !isLetters(spec)) {
    pieces.push({
      pieceType: "LED Wiring",
      qty: spec.quantity,
      heightIn: spec.heightIn,
      lengthIn: spec.widthIn,
      notes: `${spec.ledColor} LED · ${spec.illumination === "IL" ? "Internal" : "External"} illumination`,
    });
  }

  // Vinyl — Cutting + Apply are separate pieces in the workbook; if the
  // user picked CV (Cut Vinyl) both apply. DV (Digital print) goes
  // through Apply Vinyl Graphics only; FX (Wrap film) likewise.
  if (spec.vinyl === "CV") {
    pieces.push({
      pieceType: "Vinyl Cutting",
      qty: spec.quantity,
      heightIn: spec.heightIn,
      lengthIn: spec.widthIn,
      notes: spec.vinylColor || undefined,
      materialHints: spec.vinylColor ? [{
        description: spec.vinylColor,
        category: "Vinyl",
      }] : undefined,
    });
    pieces.push({
      pieceType: "Apply Vinyl Graphics",
      qty: spec.quantity,
      heightIn: spec.heightIn,
      lengthIn: spec.widthIn,
      options: spec.faceType === "RFPT" ? "Push-Through" : "Flat",
    });
  } else if (spec.vinyl === "DV" || spec.vinyl === "FX") {
    pieces.push({
      pieceType: "Apply Vinyl Graphics",
      qty: spec.quantity,
      heightIn: spec.heightIn,
      lengthIn: spec.widthIn,
      options: spec.vinyl === "DV" ? "Digital Print" : "Wrap Film",
      notes: spec.digitalRef || undefined,
    });
  }

  // Paint — only when the spec calls for shop paint. Faces param tells the
  // Paint Calculation piece how many faces it's painting.
  if (spec.finish === "P") {
    pieces.push({
      pieceType: "Paint Calculation",
      qty: spec.faces === "DF" ? 2 : 1,
      heightIn: spec.heightIn,
      lengthIn: spec.widthIn,
      notes: spec.paintColor || undefined,
    });
  }

  // Ground-mount cabinets (MN / PS) — add Pole Cover + Structural Steel
  // when a new pole is being installed. PP just gets the post-and-panel
  // primary piece, no separate pole.
  if ((spec.signTypeCode === "MN" || spec.signTypeCode === "PS") && spec.poleType === "New Pole") {
    pieces.push({
      pieceType: "Pole Cover",
      qty: 1,
      heightIn: spec.heightIn,
      lengthIn: spec.poleDiameter || "",
      notes: [spec.poleMaterial, spec.poleDiameter].filter(Boolean).join(" · "),
    });
    pieces.push({
      pieceType: "Structural Steel",
      qty: 1,
      heightIn: spec.heightIn,
      lengthIn: spec.widthIn,
      notes: spec.footingMethod || undefined,
    });
  }

  return pieces;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function primaryPiece(spec: SignSpec): EstimatingPieceDraft | null {
  const t = spec.signTypeCode;
  const df = spec.faces === "DF";
  const base = {
    qty: spec.quantity,
    heightIn: spec.heightIn,
    lengthIn: spec.widthIn,
    depthIn: spec.depthIn,
  };

  // Cabinets (WC / MN / PS) — branch on faceType + faces
  if (t === "WC" || t === "MN" || t === "PS") {
    // Non-illuminated cabinets still use the routed-cabinet sheets per the
    // workbook (the workbook collapses NI/IL onto the same piece type —
    // illumination only affects LED-line additions).
    if (spec.faceType === "RFPB" || spec.faceType === "RFPT" || spec.faceType === "AT") {
      return { pieceType: df ? "Df Routed Cabinet" : "Sf Routed Cabinet", ...base };
    }
    if (spec.faceType === "PT") {
      // Plex face cabinets — the workbook splits SF / DF / Economy variants.
      // Economy goes through "Economy Acrylic Cabinet"; we treat the
      // explicit EP sign type below, here Plex == acrylic standard.
      return { pieceType: df ? "Df Acrylic Cabinet" : "Sf Acrylic Cabinet", ...base };
    }
    if (spec.faceType === "DF") {
      // "DF" face type code = Direct Print / Flex Face in SBP. Maps to flex
      // cabinet sheets in Estimating.
      return { pieceType: df ? "Df Flex Cabinet" : "Sf Flex Cabinet", ...base };
    }
  }

  // Post & panel
  if (t === "PP") return { pieceType: "Post & Panel", ...base };

  // Pan signs
  if (t === "AP") return { pieceType: "Alum/Economy Pan", ...base, options: "Aluminum" };
  if (t === "EP") return { pieceType: "Alum/Economy Pan", ...base, options: "Economy" };

  // Channel letters
  if (t === "FL" || t === "HL" || t === "CL") {
    const lit =
      t === "FL" ? "Front-Lit" :
      t === "HL" ? "Halo-Lit" : "Combo-Lit";
    return {
      pieceType: "Channel Letter Fabrication",
      ...base,
      options: lit,
    };
  }

  // FCO / cast / formed / acrylic letters
  if (t === "AL") return { pieceType: "Routed Alum Faces Letters", ...base };
  if (t === "CA") return { pieceType: "Cast Aluminum Letters", ...base };
  if (t === "PL") return { pieceType: "Formed Plastic Letters", ...base };
  if (t === "AC") return { pieceType: "FCO Acrylic Letters", ...base };

  // EMC
  if (t === "EM") return { pieceType: "EMC Assembly", ...base };

  return null;
}

function isLetters(spec: SignSpec): boolean {
  return ["FL", "HL", "CL", "AL", "CA", "PL", "AC"].includes(spec.signTypeCode);
}

function isFrontLit(spec: SignSpec): boolean {
  return spec.signTypeCode === "FL" || spec.signTypeCode === "CL";
}
