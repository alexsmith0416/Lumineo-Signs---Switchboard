// Ballpark pricing — rough $/piece numbers computed locally. The REAL
// estimate comes from the Estimating app's calc engine against the BC
// catalog; these multipliers are for in-conversation quoting only.
//
// Keyed by Estimating piece-type id (kebab-case slugs from
// apps/estimating/src/data/pieceTypes.ts) so the same SBP→piece mapping
// drives both this rough number and the actual handoff.

import type { EstimatingPieceDraft, PieceTypeId } from "./estimateMapping";

const SHOP_LABOR_RATE = 92; // $/hr — workbook's WC sheet default

type PieceMultiplier = {
  /** Rough material $/sqft. Use 0 for labor-only pieces. */
  materialPerSqft: number;
  /** Sqft turned per labor hour. 0 means the piece is labor-by-input
      (the user enters hours directly — only the `fixedCost` / setup
      hours apply). */
  laborSqftPerHour: number;
  /** Fixed setup hours added on top of variable labor. */
  setupHours?: number;
  /** Fixed cost added once regardless of size (e.g. crating, pole). */
  fixedCost?: number;
};

const MULTIPLIERS: Record<PieceTypeId, PieceMultiplier> = {
  "freeform-tm":               { materialPerSqft: 0,  laborSqftPerHour: 0, fixedCost: 300 },
  // Graphics
  "apply-vinyl-graphics":      { materialPerSqft: 0,  laborSqftPerHour: 32 },
  "vinyl-cutting":             { materialPerSqft: 5,  laborSqftPerHour: 20 },
  "paint-calculation":         { materialPerSqft: 1.5, laborSqftPerHour: 11 },
  "routed-panel-shapes":       { materialPerSqft: 25, laborSqftPerHour: 50, setupHours: 1 },
  // Pan / post-panel
  "alum-pan-sign":             { materialPerSqft: 35, laborSqftPerHour: 14 },
  "economy-pan-sign":          { materialPerSqft: 22, laborSqftPerHour: 18 },
  "post-and-panel":            { materialPerSqft: 35, laborSqftPerHour: 12 },
  "flat-panels":               { materialPerSqft: 18, laborSqftPerHour: 72 },
  // Faces / letters
  "routed-face-only":          { materialPerSqft: 70, laborSqftPerHour: 6 },
  "routed-alum-faces-letters": { materialPerSqft: 90, laborSqftPerHour: 4, setupHours: 1 },
  "routed-push-through-acrylic": { materialPerSqft: 110, laborSqftPerHour: 3, setupHours: 1 },
  // Cabinets — face material drives the spread.
  "sf-routed-cabinet":         { materialPerSqft: 75, laborSqftPerHour: 8 },
  "df-routed-cabinet":         { materialPerSqft: 95, laborSqftPerHour: 6 },
  "sf-acrylic-cabinet":        { materialPerSqft: 55, laborSqftPerHour: 10 },
  "economy-sf-acrylic":        { materialPerSqft: 35, laborSqftPerHour: 12 },
  "df-acrylic-cabinet":        { materialPerSqft: 75, laborSqftPerHour: 8 },
  "sf-flex-cabinet":           { materialPerSqft: 45, laborSqftPerHour: 9 },
  "df-flex-cabinet":           { materialPerSqft: 65, laborSqftPerHour: 7 },
  // Structure
  "pole-cover":                { materialPerSqft: 60, laborSqftPerHour: 8,  fixedCost: 250 },
  "structural-steel":          { materialPerSqft: 0,  laborSqftPerHour: 0,  fixedCost: 800 },
  // Letters
  "trimcap-letter-face":       { materialPerSqft: 25, laborSqftPerHour: 6 },
  "channel-letter-fabrication":{ materialPerSqft: 120, laborSqftPerHour: 3, setupHours: 1 },
  // Electronics
  "emc-assembly":              { materialPerSqft: 250, laborSqftPerHour: 4, setupHours: 2 },
  "led-wiring":                { materialPerSqft: 8,  laborSqftPerHour: 12 },
};

export type BallparkLine = {
  typeId: PieceTypeId;
  label: string;
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

/** Compute the rough ballpark from piece drafts. Reads dimensions from
    each piece's `inputs.H` / `inputs.L` (Estimating's input keys) so the
    same payload shape feeds both this rough number and the real
    handoff. */
export function computeBallpark(pieces: EstimatingPieceDraft[]): BallparkQuote {
  const lines: BallparkLine[] = pieces.map((p) => {
    const h = numberInput(p.inputs.H);
    const l = numberInput(p.inputs.L);
    const qty = Math.max(1, numberInput(p.inputs.qty) || 1);
    const sqft = h && l ? (h * l) / 144 : 0;
    const m = MULTIPLIERS[p.typeId] ?? { materialPerSqft: 0, laborSqftPerHour: 0 };
    const materialEach = sqft * m.materialPerSqft + (m.fixedCost ?? 0);
    const laborHoursEach =
      sqft && m.laborSqftPerHour
        ? sqft / m.laborSqftPerHour + (m.setupHours ?? 0)
        : (m.setupHours ?? 0);
    const laborCostEach = laborHoursEach * SHOP_LABOR_RATE;
    const totalEach = materialEach + laborCostEach;
    return {
      typeId: p.typeId,
      label: p.label ?? prettifyTypeId(p.typeId),
      qty,
      sqftEach: sqft,
      materialEach,
      laborHoursEach,
      laborCostEach,
      totalEach,
      total: totalEach * qty,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const laborCost = lines.reduce((s, l) => s + l.laborCostEach * l.qty, 0);
  const materialCost = lines.reduce((s, l) => s + l.materialEach * l.qty, 0);
  const laborHours = lines.reduce((s, l) => s + l.laborHoursEach * l.qty, 0);

  return { lines, subtotal, laborCost, materialCost, laborHours, total: subtotal };
}

export function formatUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function numberInput(v: number | string | undefined): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }
  return 0;
}

function prettifyTypeId(id: PieceTypeId): string {
  return id
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
