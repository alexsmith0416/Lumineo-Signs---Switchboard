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
  /** Allowable stress increase for short-duration wind loads (UBC: 1.33). */
  stressIncrease: number;

  footingType: FootingType;
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

/** Base allowable bending stress 0.66·Fy, psi, by section shape. */
export function baseAllowablePsi(shape: SectionShape): number {
  // Pipe: A53-B Fy=35 ksi → 23,100. Tube: A500-B Fy=46 ksi → 30,360.
  return shape === 'P' ? 23100 : 30360;
}

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

function columnCheck(
  momentLbFt: number,
  shape: SectionShape,
  numColumns: number,
  stressIncrease: number,
): ColumnResult {
  const requiredSm = requiredSectionModulus(momentLbFt, shape, numColumns, stressIncrease);
  const section = selectSection(requiredSm, shape);
  if (!section || momentLbFt <= 0) {
    return {
      requiredSm,
      section: momentLbFt > 0 ? section : null,
      fbKsi: null,
      FbKsi: null,
      compactness: '',
      utilization: null,
      ok: false,
    };
  }

  const fbKsi = (momentLbFt * 12) / (section.sm * numColumns * 1000);

  let FbKsi: number | null;
  let compactness: string;
  if (shape === 'P') {
    const dt = section.odIn / section.wallIn;
    if (dt < 94.29) {
      FbKsi = 23.1 * stressIncrease;
      compactness = 'd/t < 3300/Fy — compact, Fb = 0.66Fy';
    } else {
      FbKsi = 21 * stressIncrease;
      compactness = 'd/t > 3300/Fy — Fb = 0.6Fy';
    }
  } else {
    const bt = (section.odIn - 3 * section.wallIn) / section.wallIn;
    if (bt < 28.01) {
      FbKsi = 30.36 * stressIncrease;
      compactness = 'b/t < 190/√Fy — compact, Fb = 0.66Fy';
    } else if (bt < 35.09) {
      FbKsi = 27.6 * stressIncrease;
      compactness = 'b/t < 238/√Fy — Fb = 0.6Fy';
    } else {
      FbKsi = null;
      compactness = 'b/t slender — verify with an engineer';
    }
  }

  const utilization = FbKsi ? fbKsi / FbKsi : null;
  return {
    requiredSm,
    section,
    fbKsi,
    FbKsi,
    compactness,
    utilization,
    ok: FbKsi !== null && fbKsi <= FbKsi,
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

function footingCheck(
  input: DesignInput,
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
      ? input.caissonDiaFt
      : Math.hypot(input.pierWidthFt, input.pierLengthFt);

  const emb = solveEmbedment(p, centroidFt, b, input.lateralSoilPsf);
  const d = emb.depthFt;

  const planArea =
    input.footingType === 'round'
      ? Math.PI * (input.caissonDiaFt / 2) ** 2
      : input.pierWidthFt * input.pierLengthFt;

  const signWeightLb = input.signWeightLb ?? 15 * totalArea;
  const footingWeightLb = planArea * d * CONCRETE_PCF;
  const qMaxPsf = planArea > 0 ? (signWeightLb / n + footingWeightLb) / planArea : 0;
  const qAllowedPsf = Math.min(3, Math.pow(1.2, d)) * input.bearingPsf;

  // Concrete volume: gross prism less the embedded column (pole stops 3"
  // above the bottom of the excavation, per the standard cover note).
  const embedFt = Math.max(0, d - 0.25);
  const displaced = Math.PI * (columnOdIn / 12 / 2) ** 2 * embedFt;
  const volumePerFootingYd3 = Math.max(0, planArea * d - displaced) / 27;

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
  );
  if (momentAtGradeLbFt > 0 && !column.section) {
    errors.push('No standard pipe/tube size is large enough — add columns or reduce the sign.');
  }
  if (column.section && !column.ok && column.FbKsi !== null) {
    warnings.push('Selected column exceeds its allowable bending stress — verify with an engineer.');
  }

  const footing = column.section
    ? footingCheck(input, momentAtGradeLbFt, elements, column.section.odIn)
    : null;
  if (footing && !footing.converged) {
    warnings.push('Footing depth solve did not converge — treat the footing result as invalid.');
  }
  if (footing && !footing.bearingOk) {
    warnings.push('Soil bearing check failed (q max > q allowed) — enlarge the footing or confirm soil values.');
  }

  const basePlate = column.section
    ? basePlateCheck(input, momentAtGradeLbFt, shearAtGradeLb, column.section)
    : null;

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
    basePlate,
    seismic,
    errors,
    warnings,
  };
}
