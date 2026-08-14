// Wind load / pole / footing calculation engine, ported formula-for-formula
// from the STSIGN5.xls structural workbook (UBC 1994, AISC 9th ed. ASD,
// ACI 318-89). Pure functions — no DOM, fully unit-testable.
//
// One deliberate improvement over the spreadsheet: the pole-footing embedment
// depth (UBC 1806.7, D = (A/2)(1 + sqrt(1 + 4.36h/A)) with S1 dependent on D)
// is solved iteratively here instead of asking the user to hand-iterate.

import {
  CE,
  CE_HEIGHTS,
  SEISMIC_Z,
  SHAPE_LABELS,
  isAluminum,
  sectionsFor,
  type Exposure,
  type SectionShape,
  type SteelSection,
} from '../data/tables';

// ── Input model ─────────────────────────────────────────────────────────────

export interface SignElementInput {
  id: string;
  label: string;
  widthFt: number;
  heightFt: number;
  /** Height of the TOP of this element above grade, ft. Centroid = top − height/2. */
  topFt: number;
}

export type FootingType = 'round' | 'rect';

export interface MowPadInput {
  enabled: boolean;
  /** Plan width, ft — runs along the SIDES of the cabinet (⊥ to sign face). */
  widthFt: number;
  /** Plan length, ft — runs along the FACE side of the sign. */
  lengthFt: number;
  /** Pad height above soil, in (typical 5.5"). */
  heightIn: number;
}

export interface TransitionInput {
  enabled: boolean;
  /** Splice elevation above grade, ft (null = auto at the lowest face bottom). */
  spliceFt: number | null;
}

export interface BasePlateInput {
  enabled: boolean;
  /** Bolts per line, front and back (workbook default 2). */
  boltsPerLine: number;
  /** Concrete compressive strength at 28 days, psi. */
  fcPsi: number;
  /** Override anchor bolt diameter, in (null = auto-size to next 1/8"). */
  boltDiaIn: number | null;
  /** Override spacing between bolts in a line, in (null = auto = min spacing). */
  boltSpacingIn: number | null;
  /** Fillet weld leg size for the column-to-plate weld, in. */
  weldLegIn: number;
}

export interface DesignInput {
  projectName: string;
  description: string;

  windSpeedMph: number;
  exposure: Exposure;
  /** Pressure coefficient — 1.4 for signs, flagpoles and lightpoles (UBC 16-H). */
  cq: number;
  seismicZone: 1 | 2 | 3 | 4;

  elements: SignElementInput[];

  numColumns: number;
  columnType: SectionShape;
  /** 'auto' sizes the pole from the wind moment; 'manual' uses columnSizeName. */
  columnSizing: 'auto' | 'manual';
  /** Chosen section name when columnSizing is 'manual' (e.g. `12"(.375)`). */
  columnSizeName: string | null;
  /** Allowable stress increase for short-duration wind loads (UBC: 1.33). */
  stressIncrease: number;

  footingType: FootingType;
  /** 'auto' sizes the hole from the pole; 'manual' uses the dimensions below. */
  footingSizing: 'auto' | 'manual';
  /** Total concrete clearance around the pole when auto-sizing, in (12 = 6" all round). */
  footingClearanceIn: number;
  numFootings: number;
  /** Allowable passive lateral soil resistance, psf per ft of depth (UBC 18-1-A). */
  lateralSoilPsf: number;
  /** Allowable soil bearing pressure at grade, psf (UBC 18-1-A). */
  bearingPsf: number;
  /** Round caisson diameter, ft. */
  caissonDiaFt: number;
  /** Rectangular pier plan dimensions, ft. */
  pierWidthFt: number;
  pierLengthFt: number;
  /** Total sign + steel weight, lb (null = auto at 15 psf of sign area). */
  signWeightLb: number | null;

  mowPad: MowPadInput;
  transition: TransitionInput;
  basePlate: BasePlateInput;
}

// ── Result model ────────────────────────────────────────────────────────────

export interface ElementResult {
  id: string;
  label: string;
  widthFt: number;
  heightFt: number;
  topFt: number;
  centroidFt: number;
  areaSqFt: number;
  pressurePsf: number;
  forceLb: number;
  momentLbFt: number;
}

export interface WindRow {
  heightFt: number;
  qs: number;
  ce: number;
  cq: number;
  pressurePsf: number;
}

export interface ColumnResult {
  requiredSm: number;
  section: SteelSection | null;
  /** How the section was chosen. */
  mode: 'auto' | 'manual';
  /** The size auto-sizing would pick — shown alongside a manual override. */
  autoSection: SteelSection | null;
  /** Manual choice provides less section modulus than the auto recommendation. */
  belowRecommended: boolean;
  /** Actual bending stress, ksi. */
  fbKsi: number | null;
  /** Allowable bending stress incl. wind increase, ksi (null = slender, no value). */
  FbKsi: number | null;
  compactness: string;
  utilization: number | null;
  ok: boolean;
}

export interface FootingResult {
  momentPerFootingLbFt: number;
  /** Composite centroid of the sign areas above grade, ft. */
  centroidFt: number;
  /** Equivalent concentrated load P = M/h, lb. */
  equivalentLoadLb: number;
  /** Effective footing width b, ft (diameter, or plan diagonal for rect piers). */
  effectiveWidthFt: number;
  /** Required embedment depth, ft. */
  depthFt: number;
  /** Allowable lateral soil pressure at D/3, psf. */
  s1Psf: number;
  converged: boolean;
  /** Bearing check. */
  signWeightLb: number;
  footingWeightLb: number;
  qMaxPsf: number;
  qAllowedPsf: number;
  bearingOk: boolean;
  /** Concrete quantities. */
  volumePerFootingYd3: number;
  totalVolumeYd3: number;
  /** Minimum footing size for 3" concrete cover around the pole, ft. */
  minWidthForCoverFt: number;
  /** Footing clears the pole by at least 3" all round. */
  coverOk: boolean;
  /** Plan dimensions actually used (derived from the pole when auto-sized). */
  diameterFt: number;
  planWidthFt: number;
  planLengthFt: number;
  autoSized: boolean;
}

export interface BasePlateResult {
  momentPerPlateLbFt: number;
  boltLineSpacingIn: number;
  plateNIn: number;
  plateBIn: number;
  plateThicknessIn: number;
  tensionPerBoltLineLb: number;
  tensionPerAnchorLb: number;
  minBoltDiaIn: number;
  boltDiaIn: number;
  embedLengthIn: number;
  minEdgeSpacingIn: number;
  minBoltSpacingIn: number;
  boltSpacingIn: number;
  coneCapacityLb: number;
  coneOk: boolean;
  shearStressPsi: number;
  allowedTensionPsi: number;
  actualTensionPsi: number;
  tensionOk: boolean;
  weldSectionModulusIn3: number;
  weldStressPsi: number;
  weldOk: boolean;
}

export interface MowPadResult {
  volumeYd3: number;
  /** Required minimum pad plan dimensions (footing + 6" clearance), ft. */
  requiredWidthFt: number;
  requiredLengthFt: number;
  /** True when the pad clears the footing by ≥ 6" on the smallest dimension. */
  sizeOk: boolean;
}

export interface PoleLengthResult {
  /** Depth of pole inside the footing, ft (0 when base-plate mounted). */
  embedFt: number;
  /** Full pole length: overall height + embedment, ft. */
  totalFt: number;
  orderOk: boolean; // ≤ 40 ft (longest pipe we can order)
  haulOk: boolean; // ≤ 30 ft (longest we can haul)
  recommendTransition: boolean;
}

export interface TransitionResult {
  spliceFt: number;
  overlapFt: number;
  momentAtSpliceLbFt: number;
  requiredSm: number;
  section: SteelSection | null;
  /** Upper pipe OD fits inside the base pipe ID. */
  fitsInside: boolean;
  fbKsi: number | null;
  FbKsi: number | null;
  ok: boolean;
  basePipeFt: number;
  upperPipeFt: number;
  baseIdIn: number;
  /** 1/2" ring plates: outer welded to the top of the base pipe, inner snug in its ID. */
  ringOuterOdIn: number;
  ringInnerOdIn: number;
  ringBoreIn: number | null;
  ringThicknessIn: number;
  orderOk: boolean;
  haulOk: boolean;
}

export interface SeismicResult {
  z: number;
  fpPsf: number;
  windGoverns: boolean;
}

export interface DesignResult {
  qsPsf: number;
  windTable: WindRow[];
  elements: ElementResult[];
  totalAreaSqFt: number;
  totalForceLb: number;
  momentAtGradeLbFt: number;
  shearAtGradeLb: number;
  column: ColumnResult;
  footing: FootingResult | null;
  mowPad: MowPadResult | null;
  poleLength: PoleLengthResult | null;
  transition: TransitionResult | null;
  basePlate: BasePlateResult | null;
  seismic: SeismicResult;
  errors: string[];
  warnings: string[];
}

// ── Wind pressure (UBC 1994 §1615–1621) ─────────────────────────────────────

/** Wind stagnation pressure qs = 0.00256 V^2, psf (V in mph). */
export function stagnationPressure(windSpeedMph: number): number {
  return 0.00256 * windSpeedMph * windSpeedMph;
}

/** Ce for an exact table height (UBC table 16-G row), bracketed like VLOOKUP. */
export function ceAt(heightFt: number, exposure: Exposure): number {
  const col = CE[exposure];
  let value = col[0];
  for (let i = 0; i < CE_HEIGHTS.length; i++) {
    if (CE_HEIGHTS[i] <= heightFt) value = col[i];
    else break;
  }
  return value;
}

/** Design wind pressure at a table height: P = qs · Ce · Cq, psf. */
export function designPressureAt(
  heightFt: number,
  exposure: Exposure,
  windSpeedMph: number,
  cq: number,
): number {
  return stagnationPressure(windSpeedMph) * ceAt(heightFt, exposure) * cq;
}

/**
 * Design pressure for a sign element by its centroid height — reproduces the
 * workbook's conservative "wind lookup" table, which rounds the centroid UP
 * to the next tabulated height (a centroid at exactly 15 ft uses the 20 ft
 * pressure, 14 ft uses the 15 ft pressure, etc.). Heights of 400 ft or more
 * are outside the UBC table.
 */
export function elementPressure(
  centroidFt: number,
  exposure: Exposure,
  windSpeedMph: number,
  cq: number,
): number {
  if (centroidFt <= 0) return 0;
  if (centroidFt >= 400) {
    throw new RangeError('Centroid height must be below 400 ft (UBC table 16-G).');
  }
  // First tabulated height strictly greater than the centroid.
  let bracket = CE_HEIGHTS[CE_HEIGHTS.length - 1];
  for (const h of CE_HEIGHTS) {
    if (h > centroidFt) { bracket = h; break; }
  }
  return designPressureAt(bracket, exposure, windSpeedMph, cq);
}

// ── Steel column selection (AISC 9th ed. ASD) ───────────────────────────────

/** Base allowable bending stress, psi, by section shape. */
export function baseAllowablePsi(shape: SectionShape): number {
  // Steel (AISC 9th ed. ASD, 0.66·Fy) — pipe: A53-B Fy=35 ksi → 23,100;
  // tube: A500-B Fy=46 ksi → 30,360.
  // Aluminum (Aluminum Design Manual, 6061-T6) — Fcy/Ω = 35/1.65 → 21,200.
  if (shape === 'P') return 23100;
  if (shape === 'ALTS') return ALUM_BASE_ALLOWABLE_PSI;
  return 30360;
}

/** 6061-T6 allowable bending stress, psi: Fcy 35 ksi / Ω 1.65. */
export const ALUM_BASE_ALLOWABLE_PSI = 21200;

export function requiredSectionModulus(
  momentLbFt: number,
  shape: SectionShape,
  numColumns: number,
  stressIncrease: number,
): number {
  if (numColumns <= 0) return Infinity;
  return (momentLbFt * 12) / (baseAllowablePsi(shape) * stressIncrease * numColumns);
}

/** Smallest listed section whose provided SM exceeds the required SM. */
export function selectSection(requiredSm: number, shape: SectionShape): SteelSection | null {
  for (const s of sectionsFor(shape)) {
    // The workbook's bracket lookup moves to the next size when the demand
    // exactly equals a section's capacity, so use a strict comparison.
    if (s.sm > requiredSm) return s;
  }
  return null;
}

/** Wall-thickness codes used by the workbook's legacy tube names (`8XX.25`). */
const LEGACY_TUBE_WALLS: Readonly<Record<string, number>> = {
  '19': 0.1875,
  '25': 0.25,
  '31': 0.3125,
  '37': 0.375,
  '50': 0.5,
};

/**
 * Look up a listed section by its printed name (manual pole sizing).
 *
 * Also resolves the workbook's legacy square-tube shorthand (`8XX.25` =
 * 8" × 8" × 0.25" wall) so designs saved before the sizes were renamed to
 * readable form still select the right section.
 */
export function findSectionByName(name: string, shape: SectionShape): SteelSection | null {
  const table = sectionsFor(shape);
  const exact = table.find((s) => s.name === name);
  if (exact) return exact;

  const legacy = /^(\d+)XX\.(\d+)$/.exec(name.trim());
  if (legacy) {
    const side = Number(legacy[1]);
    const wall = LEGACY_TUBE_WALLS[legacy[2]];
    if (wall !== undefined) {
      return table.find((s) => s.odIn === side && s.wallIn === wall) ?? null;
    }
  }
  return null;
}

/**
 * Allowable bending stress incl. a compactness check.
 *
 * Steel follows AISC 9th ed. ASD exactly as the workbook does. Aluminum uses
 * a deliberately SIMPLIFIED 6061-T6 model — full allowable stress up to a
 * compact flat-width ratio, then a linear reduction for local buckling up to
 * the slenderness limit. It is intended for preliminary sizing only; a
 * licensed engineer must confirm aluminum members against the current
 * Aluminum Design Manual.
 */
export function allowableBendingKsi(
  section: SteelSection,
  shape: SectionShape,
  stressIncrease: number,
): { FbKsi: number | null; note: string } {
  if (shape === 'P') {
    const dt = section.odIn / section.wallIn;
    return dt < 94.29
      ? { FbKsi: 23.1 * stressIncrease, note: 'd/t < 3300/Fy — compact, Fb = 0.66Fy' }
      : { FbKsi: 21 * stressIncrease, note: 'd/t > 3300/Fy — Fb = 0.6Fy' };
  }

  // Flat width ratio, using the workbook's b/t = (b − 3t)/t convention.
  const bt = (section.odIn - 3 * section.wallIn) / section.wallIn;

  if (shape === 'ALTS') {
    const base = ALUM_BASE_ALLOWABLE_PSI / 1000; // 21.2 ksi
    if (bt <= ALUM_COMPACT_BT) {
      return { FbKsi: base * stressIncrease, note: `b/t ${bt.toFixed(0)} — compact, Fb = Fcy/1.65 (6061-T6)` };
    }
    if (bt <= ALUM_SLENDER_BT) {
      // Linear post-buckling reduction to 60% of the compact allowable.
      const frac = 1 - 0.4 * ((bt - ALUM_COMPACT_BT) / (ALUM_SLENDER_BT - ALUM_COMPACT_BT));
      return {
        FbKsi: base * frac * stressIncrease,
        note: `b/t ${bt.toFixed(0)} — local buckling reduction (6061-T6, simplified)`,
      };
    }
    return { FbKsi: null, note: `b/t ${bt.toFixed(0)} slender — verify with an engineer` };
  }

  if (bt < 28.01) return { FbKsi: 30.36 * stressIncrease, note: 'b/t < 190/√Fy — compact, Fb = 0.66Fy' };
  if (bt < 35.09) return { FbKsi: 27.6 * stressIncrease, note: 'b/t < 238/√Fy — Fb = 0.6Fy' };
  return { FbKsi: null, note: 'b/t slender — verify with an engineer' };
}

/** Flat-width ratio below which a 6061-T6 element develops full allowable stress. */
export const ALUM_COMPACT_BT = 22;
/** Flat-width ratio above which a 6061-T6 element is treated as slender. */
export const ALUM_SLENDER_BT = 41;

/**
 * Wind moment about a height h above grade (lb-ft): elements whose centroid
 * sits below h drop out, matching the workbook's critical-height tables.
 */
export function momentAtHeight(elements: readonly ElementResult[], hFt: number): number {
  return elements.reduce(
    (s, e) => (hFt > e.centroidFt ? s : s + e.areaSqFt * e.pressurePsf * (e.centroidFt - hFt)),
    0,
  );
}

function columnCheck(
  momentLbFt: number,
  shape: SectionShape,
  numColumns: number,
  stressIncrease: number,
  sizing: 'auto' | 'manual',
  sizeName: string | null,
): ColumnResult {
  const requiredSm = requiredSectionModulus(momentLbFt, shape, numColumns, stressIncrease);
  const autoSection = selectSection(requiredSm, shape);
  // A manual choice that isn't in the current shape's table (e.g. after
  // switching pipe → tube) falls back to the auto pick.
  const manualSection = sizing === 'manual' && sizeName ? findSectionByName(sizeName, shape) : null;
  const mode: 'auto' | 'manual' = manualSection ? 'manual' : 'auto';
  const section = manualSection ?? autoSection;
  const belowRecommended =
    manualSection !== null && autoSection !== null && manualSection.sm < autoSection.sm;

  if (!section || momentLbFt <= 0) {
    return {
      requiredSm,
      section: momentLbFt > 0 ? section : null,
      mode,
      autoSection: momentLbFt > 0 ? autoSection : null,
      belowRecommended: false,
      fbKsi: null,
      FbKsi: null,
      compactness: '',
      utilization: null,
      ok: false,
    };
  }

  const fbKsi = (momentLbFt * 12) / (section.sm * numColumns * 1000);
  const { FbKsi, note: compactness } = allowableBendingKsi(section, shape, stressIncrease);
  const utilization = FbKsi ? fbKsi / FbKsi : null;
  return {
    requiredSm,
    section,
    mode,
    autoSection,
    belowRecommended,
    fbKsi,
    FbKsi,
    compactness,
    utilization,
    ok: FbKsi !== null && fbKsi <= FbKsi,
  };
}

// ── Footing plan size ───────────────────────────────────────────────────────

/** Standard auger / form diameters, in. Auto-sizing rounds up to one of these. */
export const AUGER_DIAMETERS_IN: readonly number[] = [12, 18, 24, 30, 36, 42, 48, 60, 72];

/**
 * Smallest standard auger that clears the pole by `clearanceIn` total
 * (half of it on each side), as feet. Falls back to the next 6" increment
 * above the largest listed auger.
 */
export function autoFootingWidthFt(poleOdIn: number, clearanceIn: number): number {
  const needed = poleOdIn + Math.max(0, clearanceIn);
  const stock = AUGER_DIAMETERS_IN.find((d) => d >= needed);
  return (stock ?? Math.ceil(needed / 6) * 6) / 12;
}

/** Footing plan dimensions actually used by the calculation. */
export interface FootingPlan {
  /** Round caisson diameter, ft. */
  diaFt: number;
  /** Rectangular pier width (∥ sign face), ft. */
  widthFt: number;
  /** Rectangular pier length (⊥ sign face), ft. */
  lengthFt: number;
  /** True when these were derived from the pole size rather than typed in. */
  auto: boolean;
}

/**
 * Resolve the footing plan size. In 'auto' mode every plan dimension is driven
 * by the pole's outside dimension, so changing the pole changes the hole (and
 * therefore the embedment depth and concrete volume).
 */
export function resolveFootingPlan(input: DesignInput, poleOdIn: number | null): FootingPlan {
  if (input.footingSizing === 'auto' && poleOdIn !== null) {
    const w = autoFootingWidthFt(poleOdIn, input.footingClearanceIn);
    return { diaFt: w, widthFt: w, lengthFt: w, auto: true };
  }
  return {
    diaFt: input.caissonDiaFt,
    widthFt: input.pierWidthFt,
    lengthFt: input.pierLengthFt,
    auto: false,
  };
}

// ── Pole footing embedment (UBC 1994 §1806.7, nonconstrained) ───────────────

export interface EmbedmentSolution {
  depthFt: number;
  s1Psf: number;
  converged: boolean;
}

/**
 * Solve D = (A/2)(1 + sqrt(1 + 4.36h/A)) where A = 2.34P/(S1·b) and
 * S1 = 2·q·(D/3) (lateral pressure doubled for isolated poles per UBC
 * 1806.7.2.1, evaluated at one-third depth). The spreadsheet required manual
 * iteration; here it is a damped fixed-point solve.
 */
export function solveEmbedment(
  loadLb: number,
  centroidFt: number,
  widthFt: number,
  lateralSoilPsf: number,
): EmbedmentSolution {
  if (loadLb <= 0 || widthFt <= 0 || lateralSoilPsf <= 0) {
    return { depthFt: 0, s1Psf: 0, converged: false };
  }
  let d = 4;
  let converged = false;
  for (let i = 0; i < 300; i++) {
    const s1 = 2 * lateralSoilPsf * (d / 3);
    const a = (2.34 * loadLb) / (s1 * widthFt);
    const next = (a / 2) * (1 + Math.sqrt(1 + (4.36 * centroidFt) / a));
    if (Math.abs(next - d) < 1e-9) {
      d = next;
      converged = true;
      break;
    }
    d = (d + next) / 2; // damping keeps the decreasing map from oscillating
  }
  return { depthFt: d, s1Psf: 2 * lateralSoilPsf * (d / 3), converged };
}

const CONCRETE_PCF = 150;

/** Trim trailing zeros from an inch dimension for message text. */
function fmtIn(n: number): string {
  return String(Number(n.toFixed(3)));
}

function footingCheck(
  input: DesignInput,
  plan: FootingPlan,
  momentAtGradeLbFt: number,
  elements: ElementResult[],
  columnOdIn: number,
): FootingResult | null {
  const n = input.numFootings;
  if (n <= 0 || momentAtGradeLbFt <= 0) return null;

  const totalArea = elements.reduce((s, e) => s + e.areaSqFt, 0);
  if (totalArea <= 0) return null;

  // Composite centroid of the sign faces (area-weighted, per the Pier sheet).
  const centroidFt = elements.reduce((s, e) => s + e.areaSqFt * e.centroidFt, 0) / totalArea;
  const momentPerFooting = momentAtGradeLbFt / n;
  const p = centroidFt > 0 ? momentPerFooting / centroidFt : 0;

  const b =
    input.footingType === 'round'
      ? plan.diaFt
      : Math.hypot(plan.widthFt, plan.lengthFt);

  const emb = solveEmbedment(p, centroidFt, b, input.lateralSoilPsf);
  const d = emb.depthFt;

  const planArea =
    input.footingType === 'round'
      ? Math.PI * (plan.diaFt / 2) ** 2
      : plan.widthFt * plan.lengthFt;

  const signWeightLb = input.signWeightLb ?? 15 * totalArea;
  const footingWeightLb = planArea * d * CONCRETE_PCF;
  const qMaxPsf = planArea > 0 ? (signWeightLb / n + footingWeightLb) / planArea : 0;
  const qAllowedPsf = Math.min(3, Math.pow(1.2, d)) * input.bearingPsf;

  // Concrete volume: gross prism less the embedded column (pole stops 3"
  // above the bottom of the excavation, per the standard cover note).
  const embedFt = Math.max(0, d - 0.25);
  const displaced = Math.PI * (columnOdIn / 12 / 2) ** 2 * embedFt;
  const volumePerFootingYd3 = Math.max(0, planArea * d - displaced) / 27;

  // The footing must clear the pole by the 3" minimum concrete cover all
  // round (Spec sheet), so a bigger pole forces a bigger hole.
  const minWidthForCoverFt = (columnOdIn + 6) / 12;
  const smallestPlanDimFt =
    input.footingType === 'round' ? plan.diaFt : Math.min(plan.widthFt, plan.lengthFt);
  const coverOk = smallestPlanDimFt >= minWidthForCoverFt;

  return {
    momentPerFootingLbFt: momentPerFooting,
    centroidFt,
    equivalentLoadLb: p,
    effectiveWidthFt: b,
    depthFt: d,
    s1Psf: emb.s1Psf,
    converged: emb.converged,
    signWeightLb,
    footingWeightLb,
    qMaxPsf,
    qAllowedPsf,
    bearingOk: qAllowedPsf > qMaxPsf,
    volumePerFootingYd3,
    totalVolumeYd3: volumePerFootingYd3 * n,
    minWidthForCoverFt,
    coverOk,
    diameterFt: plan.diaFt,
    planWidthFt: plan.widthFt,
    planLengthFt: plan.lengthFt,
    autoSized: plan.auto,
  };
}

// ── Mow pad (concrete apron on top of the soil around the footing) ──────────

/** Minimum clearance of the pad past the footing on each plan axis, ft (6"). */
export const MOW_PAD_CLEARANCE_FT = 0.5;

function mowPadCheck(input: DesignInput, plan: FootingPlan): MowPadResult | null {
  const mp = input.mowPad;
  if (!mp.enabled) return null;

  // Pad length runs along the sign face; width runs along the cabinet sides.
  // The matching footing dimensions must clear by ≥ 6" so the pad's form
  // frame bears on soil and the pour can't seep under it.
  const [footAlongFace, footAcross] =
    input.footingType === 'round'
      ? [plan.diaFt, plan.diaFt]
      : [plan.widthFt, plan.lengthFt];
  const requiredLengthFt = footAlongFace + MOW_PAD_CLEARANCE_FT;
  const requiredWidthFt = footAcross + MOW_PAD_CLEARANCE_FT;
  const sizeOk = mp.lengthFt >= requiredLengthFt && mp.widthFt >= requiredWidthFt;

  const volumeYd3 = (mp.widthFt * mp.lengthFt * (mp.heightIn / 12)) / 27;
  return { volumeYd3, requiredWidthFt, requiredLengthFt, sizeOk };
}

// ── Pole length limits + transition pipe splice ──────────────────────────────

/** Longest pipe we can order, ft. */
export const MAX_ORDER_FT = 40;
/** Longest pipe we can haul, ft. */
export const MAX_HAUL_FT = 30;
/** Standard splice: upper pipe extends this far into the base pipe, ft. */
export const TRANSITION_OVERLAP_FT = 2;

function poleLengthCheck(
  input: DesignInput,
  footing: FootingResult | null,
  topMaxFt: number,
): PoleLengthResult | null {
  if (topMaxFt <= 0) return null;
  const embedFt = input.basePlate.enabled || !footing ? 0 : Math.max(0, footing.depthFt - 0.25);
  const totalFt = topMaxFt + embedFt;
  return {
    embedFt,
    totalFt,
    orderOk: totalFt <= MAX_ORDER_FT,
    haulOk: totalFt <= MAX_HAUL_FT,
    recommendTransition: totalFt > MAX_HAUL_FT && !input.transition.enabled,
  };
}

function transitionCheck(
  input: DesignInput,
  elements: readonly ElementResult[],
  baseSection: SteelSection,
  poleLength: PoleLengthResult,
  topMaxFt: number,
  lowestFaceBottomFt: number,
): TransitionResult | null {
  if (!input.transition.enabled) return null;

  // Auto splice: hide it just under the lowest face when practical.
  const auto = lowestFaceBottomFt >= 4 ? lowestFaceBottomFt : topMaxFt / 2;
  const spliceFt = Math.min(Math.max(input.transition.spliceFt ?? auto, 1), Math.max(1, topMaxFt - 1));

  const momentAtSpliceLbFt = momentAtHeight(elements, spliceFt);
  const requiredSm = requiredSectionModulus(
    momentAtSpliceLbFt,
    input.columnType,
    input.numColumns,
    input.stressIncrease,
  );

  const baseIdIn = baseSection.odIn - 2 * baseSection.wallIn;
  // Upper pipe must clear the base pipe's ID (the snug part is the welded
  // inner ring plate, not the pipe itself).
  const candidates = sectionsFor(input.columnType).filter((s) => s.odIn < baseIdIn);
  const section = candidates.find((s) => s.sm > requiredSm) ?? null;
  const fitsInside = section !== null;

  let fbKsi: number | null = null;
  let FbKsi: number | null = null;
  let ok = false;
  if (section && momentAtSpliceLbFt > 0) {
    fbKsi = (momentAtSpliceLbFt * 12) / (section.sm * input.numColumns * 1000);
    FbKsi = allowableBendingKsi(section, input.columnType, input.stressIncrease).FbKsi;
    ok = FbKsi !== null && fbKsi <= FbKsi;
  } else if (section) {
    ok = true;
  }

  const basePipeFt = poleLength.embedFt + spliceFt;
  const upperPipeFt = topMaxFt - spliceFt + TRANSITION_OVERLAP_FT;
  const longest = Math.max(basePipeFt, upperPipeFt);

  return {
    spliceFt,
    overlapFt: TRANSITION_OVERLAP_FT,
    momentAtSpliceLbFt,
    requiredSm,
    section,
    fitsInside,
    fbKsi,
    FbKsi,
    ok,
    basePipeFt,
    upperPipeFt,
    baseIdIn,
    ringOuterOdIn: baseSection.odIn,
    ringInnerOdIn: baseIdIn,
    ringBoreIn: section ? section.odIn : null,
    ringThicknessIn: 0.5,
    orderOk: longest <= MAX_ORDER_FT,
    haulOk: longest <= MAX_HAUL_FT,
  };
}

// ── Base plate + anchor bolts (AISC Design Guide 1) ─────────────────────────

/** Area of the lens-shaped overlap of two circles of radius r at spacing s. */
function circleOverlapArea(r: number, s: number): number {
  if (s >= 2 * r) return 0;
  return 2 * r * r * Math.acos(s / (2 * r)) - (s / 2) * Math.sqrt(4 * r * r - s * s);
}

function roundUpToEighth(x: number): number {
  return Math.ceil(x * 8) / 8;
}

function basePlateCheck(
  input: DesignInput,
  momentAtGradeLbFt: number,
  shearAtGradeLb: number,
  section: SteelSection,
): BasePlateResult | null {
  const bp = input.basePlate;
  const nPlates = input.numColumns;
  if (!bp.enabled || nPlates <= 0 || momentAtGradeLbFt <= 0) return null;

  const od = section.odIn;
  const n = bp.boltsPerLine;
  const mPlate = momentAtGradeLbFt / nPlates; // lb-ft

  // Workbook geometry: bolt lines straddle the column at OD+4; plate is OD+8.
  const L = od + 4;
  const plateN = od + 8;
  const plateB = od + 8;

  const T = (mPlate * 12) / L; // lb per bolt line (simple moment couple)
  const mPl = T * ((L - od) / 2); // lb-in on the plate
  // t = sqrt(6·Mpl / (0.75·Fy·(4/3) · Beff)), Fy = 36 ksi → 35,910 psi.
  const beff = 2 * n * ((L - od) / 2);
  const t = Math.sqrt((6 * mPl) / (35910 * beff));

  const Ta = T / n;
  const agReq = Ta / (19140 * 1.33); // 0.33·Fu(58 ksi) with wind increase
  const minDia = 2 * Math.sqrt(agReq / Math.PI);
  const dia = bp.boltDiaIn ?? Math.max(0.5, roundUpToEighth(minDia));

  const apReq = Ta / (2 * Math.sqrt(bp.fcPsi * 1.33));
  const embedRaw = Math.sqrt(apReq / Math.PI);
  const embed = embedRaw < 12 * dia ? 20 * dia : embedRaw;

  const minEdge = embed;
  const minSpacing = 2 * embed;
  const spacing = bp.boltSpacingIn ?? Math.ceil(minSpacing);

  const overlaps = n > 2 ? 2 : 1;
  const apRevised =
    Math.PI * embed * embed - overlaps * circleOverlapArea(embed, spacing);
  const coneCapacity = apRevised * 2 * Math.sqrt(bp.fcPsi) * 1.33;

  const boltArea = Math.PI * (dia / 2) ** 2;
  const fv = shearAtGradeLb / (nPlates * 2 * n * boltArea);
  const ftAllowed = Math.min(25456, 33170 - 1.8 * fv);
  const ftActual = Ta / boltArea;

  const sw =
    input.columnType === 'P'
      ? Math.PI * (od / 2) ** 2 * bp.weldLegIn
      : 1.34 * od * od * bp.weldLegIn;
  const fw = sw > 0 ? (mPlate * 12) / sw : Infinity;

  return {
    momentPerPlateLbFt: mPlate,
    boltLineSpacingIn: L,
    plateNIn: plateN,
    plateBIn: plateB,
    plateThicknessIn: t,
    tensionPerBoltLineLb: T,
    tensionPerAnchorLb: Ta,
    minBoltDiaIn: minDia,
    boltDiaIn: dia,
    embedLengthIn: embed,
    minEdgeSpacingIn: minEdge,
    minBoltSpacingIn: minSpacing,
    boltSpacingIn: spacing,
    coneCapacityLb: coneCapacity,
    coneOk: coneCapacity > Ta,
    shearStressPsi: fv,
    allowedTensionPsi: ftAllowed,
    actualTensionPsi: ftActual,
    tensionOk: ftActual <= ftAllowed,
    weldSectionModulusIn3: sw,
    weldStressPsi: fw,
    weldOk: fw <= 21000,
  };
}

// ── Top-level design ────────────────────────────────────────────────────────

export function computeDesign(input: DesignInput): DesignResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const qsPsf = stagnationPressure(input.windSpeedMph);
  const windTable: WindRow[] = CE_HEIGHTS.map((h) => ({
    heightFt: h,
    qs: qsPsf,
    ce: ceAt(h, input.exposure),
    cq: input.cq,
    pressurePsf: designPressureAt(h, input.exposure, input.windSpeedMph, input.cq),
  }));

  const elements: ElementResult[] = [];
  for (const el of input.elements) {
    const centroidFt = el.topFt - el.heightFt / 2;
    const areaSqFt = el.widthFt * el.heightFt;
    let pressurePsf = 0;
    try {
      pressurePsf = elementPressure(centroidFt, input.exposure, input.windSpeedMph, input.cq);
    } catch (e) {
      errors.push(`${el.label || 'Element'}: ${(e as Error).message}`);
    }
    if (centroidFt < 0) {
      errors.push(`${el.label || 'Element'}: centroid is below grade — check height vs. top elevation.`);
    }
    const forceLb = areaSqFt * pressurePsf;
    elements.push({
      id: el.id,
      label: el.label,
      widthFt: el.widthFt,
      heightFt: el.heightFt,
      topFt: el.topFt,
      centroidFt,
      areaSqFt,
      pressurePsf,
      forceLb,
      momentLbFt: forceLb * Math.max(0, centroidFt),
    });
  }

  const totalAreaSqFt = elements.reduce((s, e) => s + e.areaSqFt, 0);
  const totalForceLb = elements.reduce((s, e) => s + e.forceLb, 0);
  const momentAtGradeLbFt = elements.reduce((s, e) => s + e.momentLbFt, 0);
  const shearAtGradeLb = totalForceLb;

  const column = columnCheck(
    momentAtGradeLbFt,
    input.columnType,
    input.numColumns,
    input.stressIncrease,
    input.columnSizing,
    input.columnSizeName,
  );
  if (momentAtGradeLbFt > 0 && !column.section) {
    errors.push(
      isAluminum(input.columnType)
        ? 'No stocked aluminum tube is large enough — add poles, switch to steel, or reduce the sign.'
        : 'No standard pipe/tube size is large enough — add columns or reduce the sign.',
    );
  }
  if (column.section && !column.ok && column.FbKsi !== null) {
    warnings.push(
      column.mode === 'manual'
        ? `Chosen pole ${column.section.name} is overstressed (fb ${(column.fbKsi ?? 0).toFixed(1)} ksi > Fb ${column.FbKsi.toFixed(1)} ksi)` +
            `${column.autoSection ? ` — ${column.autoSection.name} or larger is required` : ''}.`
        : 'Selected column exceeds its allowable bending stress — verify with an engineer.',
    );
  }
  if (input.columnSizing === 'manual' && input.columnSizeName && column.mode === 'auto') {
    warnings.push(
      `Pole size "${input.columnSizeName}" isn't a ${SHAPE_LABELS[input.columnType].long.toLowerCase()} size — using the recommended size instead.`,
    );
  }

  // Resolve the hole size first — in auto mode it follows the chosen pole, so
  // the embedment solve and concrete volume both move with the pole size.
  const footingPlan = resolveFootingPlan(input, column.section?.odIn ?? null);
  const footing = column.section
    ? footingCheck(input, footingPlan, momentAtGradeLbFt, elements, column.section.odIn)
    : null;
  if (footing && !footing.converged) {
    warnings.push('Footing depth solve did not converge — treat the footing result as invalid.');
  }
  if (footing && !footing.bearingOk) {
    warnings.push('Soil bearing check failed (q max > q allowed) — enlarge the footing or confirm soil values.');
  }
  if (footing && !footing.coverOk && column.section) {
    warnings.push(
      `Footing is too small for the ${fmtIn(column.section.odIn)}" pole — it needs to be at least ` +
        `${footing.minWidthForCoverFt.toFixed(2)} ft across to keep 3" of concrete cover around the steel.`,
    );
  }

  const mowPad = mowPadCheck(input, footingPlan);
  if (mowPad && !mowPad.sizeOk) {
    warnings.push(
      `Mow pad is too small for the footing — every pad dimension must clear the footing by at least 6" ` +
        `(need ≥ ${mowPad.requiredLengthFt} ft along the face × ${mowPad.requiredWidthFt} ft across) so the ` +
        `form frame bears on soil and the pour can't seep under it.`,
    );
  }

  const validFaces = elements.filter((e) => e.widthFt > 0 && e.heightFt > 0 && e.topFt > 0);
  const topMaxFt = validFaces.length ? Math.max(...validFaces.map((e) => e.topFt)) : 0;
  const lowestFaceBottomFt = validFaces.length
    ? Math.min(...validFaces.map((e) => Math.max(0, e.topFt - e.heightFt)))
    : 0;

  const poleLength = poleLengthCheck(input, footing, topMaxFt);
  const transition =
    column.section && poleLength
      ? transitionCheck(input, elements, column.section, poleLength, topMaxFt, lowestFaceBottomFt)
      : null;

  if (poleLength && !input.transition.enabled) {
    if (!poleLength.orderOk) {
      warnings.push(
        `Pole length ${poleLength.totalFt.toFixed(1)} ft exceeds the ${MAX_ORDER_FT} ft max order length — enable a transition pipe.`,
      );
    } else if (!poleLength.haulOk) {
      warnings.push(
        `Pole length ${poleLength.totalFt.toFixed(1)} ft exceeds the ${MAX_HAUL_FT} ft haul limit — consider a transition pipe.`,
      );
    }
  }
  if (transition) {
    if (!transition.fitsInside) {
      warnings.push(
        'No standard upper pipe both carries the splice moment and fits inside the base pipe ID — raise the splice or upsize the base pipe.',
      );
    } else if (!transition.ok) {
      warnings.push('Upper transition pipe exceeds its allowable bending stress — raise the splice or upsize.');
    }
    if (!transition.orderOk) {
      warnings.push(`A transition piece still exceeds the ${MAX_ORDER_FT} ft order limit — move the splice.`);
    } else if (!transition.haulOk) {
      warnings.push(`A transition piece still exceeds the ${MAX_HAUL_FT} ft haul limit — move the splice.`);
    }
  }

  const basePlate = column.section
    ? basePlateCheck(input, momentAtGradeLbFt, shearAtGradeLb, column.section)
    : null;

  // Aluminum practice notes — these are fabrication/detailing requirements the
  // steel workbook never had to deal with.
  if (isAluminum(input.columnType) && column.section) {
    if (!input.basePlate.enabled && footing) {
      warnings.push(
        'Aluminum must not be cast directly against concrete — coat or sleeve the embedded length to isolate it from the alkaline concrete, or mount on a base plate above grade.',
      );
    }
    if (input.basePlate.enabled) {
      warnings.push(
        'Base plate, anchor bolt and weld checks assume A36 steel — for an aluminum pole have an engineer confirm the plate, the welded connection (6061-T6 loses strength in the weld heat-affected zone) and isolation from dissimilar metals.',
      );
    }
    if (transition?.section) {
      warnings.push(
        'Transition ring plates are specified as steel — on an aluminum pole the splice needs engineered aluminum detailing (weld HAZ strength) and isolation from the steel plates.',
      );
    }
    warnings.push(
      "Aluminum deflects about 3× as much as steel for the same section (E ≈ 10,000 ksi vs 29,000 ksi) — check sway/deflection, not just stress.",
    );
  }

  const z = SEISMIC_Z[input.seismicZone] ?? 0.4;
  const fpPsf = z * 1 * 2 * 15; // Fp = Z·I·Cp·Wp (I=1 standard, Cp=2 signs, Wp=15 psf)
  const minElementPressure = elements
    .filter((e) => e.areaSqFt > 0)
    .reduce((m, e) => Math.min(m, e.pressurePsf), Infinity);
  const seismic: SeismicResult = {
    z,
    fpPsf,
    windGoverns: minElementPressure === Infinity ? true : minElementPressure >= fpPsf,
  };
  if (!seismic.windGoverns) {
    warnings.push('Seismic load exceeds wind pressure — a seismic design check is required.');
  }

  return {
    qsPsf,
    windTable,
    elements,
    totalAreaSqFt,
    totalForceLb,
    momentAtGradeLbFt,
    shearAtGradeLb,
    column,
    footing,
    mowPad,
    poleLength,
    transition,
    basePlate,
    seismic,
    errors,
    warnings,
  };
}
