// Ballpark pricing — rough $/piece numbers computed locally in Sign Builder
// Pro. The REAL estimate comes from the Estimating app once the BC catalog
// (lum_invitem / lum_workcode / lum_ratedata) is connected. Until then
// these multipliers give Sales a same-order-of-magnitude figure to quote
// from in-conversation; they are explicitly NOT a binding price.
//
// Multipliers come from a quick survey of recent jobs and from the
// workbook's process-rate sheet — see comments per piece type. All hourly
// labor uses $92/hr (the shop's default from the workbook's WC sheet).

import type { EstimatingPieceDraft, EstimatingPieceType } from "./estimateMapping";

const SHOP_LABOR_RATE = 92; // $/hr — from the workbook's WC sheet default

// Per-piece-type cost approximations. `materialPerSqft` is the rough
// installed material cost we'd quote per square foot of face area;
// `laborSqftPerHour` is how many sqft the shop turns per hour (so labor
// hours = sqft / laborSqftPerHour). Both are deliberately conservative.
type PieceMultiplier = {
  /** Rough material $/sqft. Use 0 for labor-only pieces. */
  materialPerSqft: number;
  /** Process rate — sqft of face area per labor hour. */
  laborSqftPerHour: number;
  /** Fixed setup hours added on top of variable labor. */
  setupHours?: number;
  /** Optional fixed cost added once regardless of size (e.g. crating). */
  fixedCost?: number;
};

const MULTIPLIERS: Record<EstimatingPieceType, PieceMultiplier> = {
  // — Cabinets — face material drives the spread. Routed > Acrylic > Flex
  //   for material cost; flex faces are cheaper but slower to build.
  "Sf Routed Cabinet":   { materialPerSqft: 75, laborSqftPerHour: 8 },
  "Df Routed Cabinet":   { materialPerSqft: 95, laborSqftPerHour: 6 },
  "Sf Acrylic Cabinet":  { materialPerSqft: 55, laborSqftPerHour: 10 },
  "Df Acrylic Cabinet":  { materialPerSqft: 75, laborSqftPerHour: 8 },
  "Economy Acrylic Cabinet": { materialPerSqft: 35, laborSqftPerHour: 12 },
  "Sf Flex Cabinet":     { materialPerSqft: 45, laborSqftPerHour: 9 },
  "Df Flex Cabinet":     { materialPerSqft: 65, laborSqftPerHour: 7 },

  "Alum/Economy Pan":    { materialPerSqft: 30, laborSqftPerHour: 14 },
  "Post & Panel":        { materialPerSqft: 35, laborSqftPerHour: 12 },
  "Pole Cover":          { materialPerSqft: 60, laborSqftPerHour: 8, fixedCost: 250 },
  "Structural Steel":    { materialPerSqft: 0,  laborSqftPerHour: 10, fixedCost: 800 },

  // Letters — slow to build, face-area drives both inputs.
  "Channel Letter Fabrication": { materialPerSqft: 120, laborSqftPerHour: 3, setupHours: 1 },
  "Trimcap Letter Face":        { materialPerSqft: 25,  laborSqftPerHour: 6 },
  "Routed Alum Faces Letters":  { materialPerSqft: 90,  laborSqftPerHour: 4 },
  "Routed Push-Through Acrylic":{ materialPerSqft: 110, laborSqftPerHour: 3 },
  "Cast Aluminum Letters":      { materialPerSqft: 180, laborSqftPerHour: 2 },
  "Formed Plastic Letters":     { materialPerSqft: 60,  laborSqftPerHour: 6 },
  "FCO Acrylic Letters":        { materialPerSqft: 70,  laborSqftPerHour: 5 },

  // Electronics
  "EMC Assembly":  { materialPerSqft: 250, laborSqftPerHour: 4, setupHours: 2 },
  "LED Wiring":    { materialPerSqft: 8,   laborSqftPerHour: 12 },

  // Graphics — Apply Vinyl is labor-only (vinyl line lives on Vinyl
  // Cutting); both use the workbook's explicit sqft/hr values.
  "Vinyl Cutting":         { materialPerSqft: 5, laborSqftPerHour: 20 },
  "Apply Vinyl Graphics":  { materialPerSqft: 0, laborSqftPerHour: 32 },

  // Paint — workbook splits prime + topcoat (20 / 25 sqft/hr each). We
  // collapse to a single combined rate for the ballpark.
  "Paint Calculation": { materialPerSqft: 1.5, laborSqftPerHour: 11 },
};

export type BallparkLine = {
  pieceType: EstimatingPieceType;
  qty: number;
  sqftEach: number;
  materialEach: number;
  laborHoursEach: number;
  laborCostEach: number;
  totalEach: number;
  total: number;
};

export type BallparkQuote = {
  lines: BallparkLine[];
  subtotal: number;
  laborHours: number;
  laborCost: number;
  materialCost: number;
  total: number;
};

/** Compute the rough ballpark for an array of piece drafts (from
    `mapSpecToEstimatePieces`). Returns one line per piece + a roll-up. */
export function computeBallpark(pieces: EstimatingPieceDraft[]): BallparkQuote {
  const lines: BallparkLine[] = pieces.map((p) => {
    const h = Number(p.heightIn) || 0;
    const l = Number(p.lengthIn) || 0;
    // sqft from H × L in inches → square feet. Some pieces don't have a
    // sqft basis (e.g. crating, fixed-cost) — for those we set sqft = 0
    // and rely on fixedCost / setup hours.
    const sqft = h && l ? (h * l) / 144 : 0;
    const m = MULTIPLIERS[p.pieceType];
    const materialEach = sqft * m.materialPerSqft + (m.fixedCost ?? 0);
    const laborHoursEach =
      sqft && m.laborSqftPerHour ? sqft / m.laborSqftPerHour + (m.setupHours ?? 0) : (m.setupHours ?? 0);
    const laborCostEach = laborHoursEach * SHOP_LABOR_RATE;
    const totalEach = materialEach + laborCostEach;
    return {
      pieceType: p.pieceType,
      qty: p.qty,
      sqftEach: sqft,
      materialEach,
      laborHoursEach,
      laborCostEach,
      totalEach,
      total: totalEach * p.qty,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const laborCost = lines.reduce((s, l) => s + l.laborCostEach * l.qty, 0);
  const materialCost = lines.reduce((s, l) => s + l.materialEach * l.qty, 0);
  const laborHours = lines.reduce((s, l) => s + l.laborHoursEach * l.qty, 0);

  return {
    lines,
    subtotal,
    laborCost,
    materialCost,
    laborHours,
    total: subtotal,
  };
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
