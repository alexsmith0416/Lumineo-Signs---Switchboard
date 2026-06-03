// AUTO-GENERATED from reference/estimating/Sign365 LN Estimate Template - Blank.xlsx
// Generated 2026-06-03T12:31:51Z by scripts/extract-workbook.py
// DO NOT EDIT BY HAND — re-run `npm run extract:estimating` to refresh.

/** Tier in a sqft-threshold lookup table (e.g. 'pan' rates). */
export interface RateTier {
  /** Lower-bound sqft (inclusive). The first tier always has threshold=0. */
  readonly threshold: number;
  /** Labor hours/sqft applied above this threshold. */
  readonly rate: number;
}

/** Look up the rate that applies at a given sqft value. */
export function tierFor(table: readonly RateTier[], sqft: number): number {
  let chosen = table[0]?.rate ?? 0;
  for (const t of table) {
    if (sqft >= t.threshold) chosen = t.rate;
    else break;
  }
  return chosen;
}

export const RATES = Object.freeze({
  vinylCutSqftPerHour: 20.0,
  vinylApplyFlatSqftPerHour: 32.0,
  vinylApplyPushThroughSqftPerHour: 15.0,
  paintGramsPerSqft: 100.0,
  extraPaintColorPct: 0.1,
  cabinetPaintPrepSqftPerHour: 19.0,
  cabinetPaintSqftPerHour: 23.75,
  panPaintPrepSqftPerHour: 43.75,
  panPaintSqftPerHour: 28.5,
  postPanelPaintPrepSqftPerHour: 15.0,
  postPanelPaintSqftPerHour: 15.0,
  revealPaintPrepSqftPerHour: 15.0,
  revealPaintSqftPerHour: 15.0,
  crownPaintPrepSqftPerHour: 6.0,
  crownPaintSqftPerHour: 15.0,
  radiusOrAngleExtraLaborPct: 0.25,
  postPanelPostFabFtPerHour: 24.0,
  ledWiringSqftPerHour: 14.25,
  synergyLedsPerSqft: 1.3,
  synergyLedsPerPowerSupply: 108.0,
  quickmodLedsPerSqft: 1.5,
  quickmodLedsPerPowerSupply: 50.0,
  acrylicCutSqftPerHour: 72.0,
  polycarbCutSqftPerHour: 48.0,
  acmCutSqftPerHour: 96.0,
  prepaintedAlumCutSqftPerHour: 96.0,
  routerSetupHours: 1.0,
  letterPerimeterPathFactor: 6.0,
  routedPanelShapeSqftPerHour: 50.0,
  routingAluminumInchesPerHour: 200.0,
  routingPushThroughInchesPerHour: 100.0,
  routedPopStudSqftPerHour: 60.0,
  routedBackerAssemblySqftPerHour: 15.0,
  routedFaceFabricationSqftPerHour: 6.0,
  retainerAssemblySqftPerHour: 40.0,
  flexFaceAssemblySqftPerHour: 15.0,
  flexFaceClipPlasticPerFoot: 2.0,
  flexFaceMetalClipPerFoot: 1.34,
  emcHandPaintSqftPerHour: 20.0,
  ccRailFabFtPerHour: 16.0,
  trimCapFaceFabInchesPerHour: 21.0,
  channelLetterBlockFabInchesPerHour: 18.0,
  channelLetterSerifFabInchesPerHour: 12.0,
  channelLetterScriptFabInchesPerHour: 8.0,
  channelLetterPaintPrepSqftPerHour: 15.0,
  channelLetterPaintSqftPerHour: 15.0,
  largePoleCoverFaceMaterialChangeSize: 50.0,
  largePoleCoverFrameMultiplier: 1.3,
  largePoleCoverFrameMultiplierSize: 61.0,
  hourRoundingFactor: 0.25,
  dividerBarFtPerHour: 8.0,
} as const);

export type Rates = typeof RATES;

export const TABLES = Object.freeze({
  pan: Object.freeze([
    { threshold: 0.0, rate: 1.9 },
    { threshold: 5.0, rate: 3.8 },
    { threshold: 25.0, rate: 6.65 },
    { threshold: 40.0, rate: 9.5 },
    { threshold: 50.0, rate: 6.65 },
  ] as readonly RateTier[]),
  postAndPanel: Object.freeze([
    { threshold: 0.0, rate: 0.95 },
    { threshold: 4.0, rate: 1.9 },
    { threshold: 10.0, rate: 2.85 },
    { threshold: 20.0, rate: 3.8 },
    { threshold: 30.0, rate: 6.65 },
  ] as readonly RateTier[]),
  routedCabinet: Object.freeze([
    { threshold: 0.0, rate: 0.95 },
    { threshold: 4.0, rate: 1.9 },
    { threshold: 8.0, rate: 2.38 },
    { threshold: 20.0, rate: 2.85 },
  ] as readonly RateTier[]),
  acrylicCabinet: Object.freeze([
    { threshold: 0.0, rate: 0.95 },
    { threshold: 4.0, rate: 1.9 },
    { threshold: 8.0, rate: 2.85 },
    { threshold: 18.0, rate: 3.8 },
  ] as readonly RateTier[]),
  flexCabinet: Object.freeze([
    { threshold: 0.0, rate: 1.9 },
    { threshold: 32.0, rate: 2.38 },
    { threshold: 80.0, rate: 2.85 },
  ] as readonly RateTier[]),
  polecover: Object.freeze([
    { threshold: 0.0, rate: 0.95 },
    { threshold: 5.0, rate: 1.9 },
    { threshold: 25.0, rate: 2.85 },
    { threshold: 50.0, rate: 3.8 },
  ] as readonly RateTier[]),
  reveal: Object.freeze([
    { threshold: 0.0, rate: 9.5 },
    { threshold: 20.0, rate: 6.65 },
  ] as readonly RateTier[]),
  crown: Object.freeze([
    { threshold: 0.0, rate: 1.9 },
    { threshold: 20.0, rate: 3.8 },
  ] as readonly RateTier[]),
  EMC: Object.freeze([
    { threshold: 0.0, rate: 2.85 },
    { threshold: 10.0, rate: 3.8 },
    { threshold: 33.0, rate: 4.75 },
    { threshold: 65.0, rate: 6.65 },
    { threshold: 100.0, rate: 9.5 },
  ] as readonly RateTier[]),
} as const);

export type Tables = typeof TABLES;
