// Engine acceptance tests. Expected values are taken directly from the
// STSIGN5.xls workbook (cells recomputed with its stored formulas), so these
// pin the port to the spreadsheet's behavior.

import { describe, expect, it } from 'vitest';

import {
  ceAt,
  computeDesign,
  designPressureAt,
  elementPressure,
  requiredSectionModulus,
  selectSection,
  solveEmbedment,
  stagnationPressure,
  type DesignInput,
} from '../lib/engine';
import { PIPE_SECTIONS, TUBE_SECTIONS } from '../data/tables';

const V = 115; // workbook default basic wind speed
const CQ = 1.4;

describe('wind pressures (Wind sheet)', () => {
  it('computes the stagnation pressure qs = 0.00256 V^2', () => {
    expect(stagnationPressure(V)).toBeCloseTo(33.856, 6); // Wind!D15
  });

  it('reads Ce from UBC table 16-G per exposure', () => {
    expect(ceAt(15, 'C')).toBeCloseTo(1.06);
    expect(ceAt(15, 'B')).toBeCloseTo(0.62);
    expect(ceAt(15, 'D')).toBeCloseTo(1.39);
    expect(ceAt(400, 'C')).toBeCloseTo(2.19);
    // bracket behavior: 25 ≤ h < 30 uses the 25 ft row
    expect(ceAt(29, 'C')).toBeCloseTo(1.19);
  });

  it('matches the workbook design pressure column (Wind!G15:G27, exposure C)', () => {
    expect(designPressureAt(15, 'C', V, CQ)).toBeCloseTo(50.242304, 6);
    expect(designPressureAt(20, 'C', V, CQ)).toBeCloseTo(53.560192, 6);
    expect(designPressureAt(25, 'C', V, CQ)).toBeCloseTo(56.404096, 6);
    expect(designPressureAt(100, 'C', V, CQ)).toBeCloseTo(76.311424, 6);
    expect(designPressureAt(400, 'C', V, CQ)).toBeCloseTo(103.802496, 6);
  });

  it('rounds element centroids UP to the next tabulated height (wind lookup table)', () => {
    // Wind!K12:L26 — centroid 7 ft → 15 ft pressure; 15 ft → 20 ft pressure;
    // 20 ft → 25 ft pressure (conservative bracketing).
    expect(elementPressure(7, 'C', V, CQ)).toBeCloseTo(50.242304, 6);
    expect(elementPressure(14.9, 'C', V, CQ)).toBeCloseTo(50.242304, 6);
    expect(elementPressure(15, 'C', V, CQ)).toBeCloseTo(53.560192, 6);
    expect(elementPressure(20, 'C', V, CQ)).toBeCloseTo(56.404096, 6);
    expect(elementPressure(299, 'C', V, CQ)).toBeCloseTo(97.16672, 5);
    expect(elementPressure(350, 'C', V, CQ)).toBeCloseTo(103.802496, 6);
    expect(elementPressure(0, 'C', V, CQ)).toBe(0);
    expect(() => elementPressure(400, 'C', V, CQ)).toThrow(RangeError);
  });
});

describe('steel column selection (Column + Tables sheets)', () => {
  it('computes required SM = M·12 / (0.66Fy · 1.33 · Ncols)', () => {
    // pipe: 23,100 psi base allowable
    expect(requiredSectionModulus(100000, 'P', 2, 1.33)).toBeCloseTo(
      (100000 * 12) / (23100 * 1.33 * 2),
      9,
    );
    // tube: 30,360 psi base allowable
    expect(requiredSectionModulus(100000, 'TS', 1, 1.33)).toBeCloseTo(
      (100000 * 12) / (30360 * 1.33),
      9,
    );
  });

  it('selects pipe sizes on the workbook brackets', () => {
    expect(selectSection(1.0, 'P')?.name).toBe('3"(.216)');
    // exact capacity moves to the next size, matching the VLOOKUP table
    expect(selectSection(1.72, 'P')?.name).toBe('3.5"(.226)');
    expect(selectSection(44.06, 'P')?.name).toBe('14"(.375)');
    expect(selectSection(900, 'P')?.name).toBe('42"(.750)');
    expect(selectSection(985, 'P')).toBeNull();
  });

  it('selects tube sizes on the workbook brackets', () => {
    expect(selectSection(2.0, 'TS')?.name).toBe('3XX.25');
    expect(selectSection(30, 'TS')?.name).toBe('10XX.25');
    // exact capacity moves to the next size, matching the VLOOKUP table
    expect(selectSection(30.1, 'TS')?.name).toBe('10XX.31');
    expect(selectSection(151, 'TS')).toBeNull();
  });

  it('keeps the lookup tables internally consistent', () => {
    for (const table of [PIPE_SECTIONS, TUBE_SECTIONS]) {
      for (let i = 1; i < table.length; i++) {
        expect(table[i].sm).toBeGreaterThan(table[i - 1].sm);
        expect(table[i].odIn).toBeGreaterThanOrEqual(table[i - 1].odIn);
      }
      for (const s of table) {
        expect(s.odIn / s.wallIn).toBeGreaterThan(1);
        expect(s.areaSqIn).toBeGreaterThan(0);
      }
    }
  });
});

describe('pole footing embedment (Pier sheet, UBC 1806.7)', () => {
  it('satisfies the UBC fixed-point equations at the solution', () => {
    const P = 5640.4;
    const h = 20;
    const b = 3;
    const q = 200;
    const { depthFt, s1Psf, converged } = solveEmbedment(P, h, b, q);
    expect(converged).toBe(true);
    expect(s1Psf).toBeCloseTo(2 * q * (depthFt / 3), 6);
    const a = (2.34 * P) / (s1Psf * b);
    const dCheck = (a / 2) * (1 + Math.sqrt(1 + (4.36 * h) / a));
    expect(depthFt).toBeCloseTo(dCheck, 6);
    expect(depthFt).toBeGreaterThan(0);
  });

  it('needs deeper footings for bigger loads and shallower for wider footings', () => {
    const base = solveEmbedment(5000, 20, 3, 200).depthFt;
    expect(solveEmbedment(10000, 20, 3, 200).depthFt).toBeGreaterThan(base);
    expect(solveEmbedment(5000, 20, 4, 200).depthFt).toBeLessThan(base);
    expect(solveEmbedment(5000, 20, 3, 400).depthFt).toBeLessThan(base);
  });

  it('returns a zero, non-converged solution for degenerate input', () => {
    expect(solveEmbedment(0, 20, 3, 200)).toEqual({ depthFt: 0, s1Psf: 0, converged: false });
  });
});

function baseInput(): DesignInput {
  return {
    projectName: 'Test',
    description: '',
    windSpeedMph: V,
    exposure: 'C',
    cq: CQ,
    seismicZone: 3,
    elements: [
      { id: 'a', label: 'Cabinet', widthFt: 20, heightFt: 10, topFt: 25 },
    ],
    numColumns: 2,
    columnType: 'P',
    stressIncrease: 1.33,
    footingType: 'round',
    numFootings: 2,
    lateralSoilPsf: 200,
    bearingPsf: 1330,
    caissonDiaFt: 3,
    pierWidthFt: 3,
    pierLengthFt: 3,
    signWeightLb: null,
    basePlate: {
      enabled: true,
      boltsPerLine: 2,
      fcPsi: 2500,
      boltDiaIn: null,
      boltSpacingIn: null,
      weldLegIn: 0.3125,
    },
  };
}

describe('computeDesign end-to-end (20 ft × 10 ft cabinet, top at 25 ft, 2 pipes)', () => {
  it('reproduces the workbook chain: pressure → moment → pole → footing', () => {
    const r = computeDesign(baseInput());

    // Element: centroid 20 ft → 25 ft bracket pressure, area 200 sq ft.
    expect(r.elements[0].centroidFt).toBe(20);
    expect(r.elements[0].pressurePsf).toBeCloseTo(56.404096, 6);
    expect(r.totalAreaSqFt).toBe(200);
    expect(r.shearAtGradeLb).toBeCloseTo(200 * 56.404096, 4);
    expect(r.momentAtGradeLbFt).toBeCloseTo(200 * 56.404096 * 20, 3);

    // Pole: Sreq = M·12/(23100·1.33·2) ≈ 44.06 → 14"(.375) pipe.
    expect(r.column.requiredSm).toBeCloseTo(
      (r.momentAtGradeLbFt * 12) / (23100 * 1.33 * 2),
      6,
    );
    expect(r.column.section?.name).toBe('14"(.375)');
    expect(r.column.fbKsi).toBeCloseTo(
      (r.momentAtGradeLbFt * 12) / (53.2 * 2 * 1000),
      6,
    );
    expect(r.column.FbKsi).toBeCloseTo(23.1 * 1.33, 6);
    expect(r.column.ok).toBe(true);

    // Footing: P = (M/2)/20 per footing, then the UBC embedment solve.
    const f = r.footing!;
    expect(f.centroidFt).toBeCloseTo(20, 9);
    expect(f.momentPerFootingLbFt).toBeCloseTo(r.momentAtGradeLbFt / 2, 6);
    expect(f.equivalentLoadLb).toBeCloseTo(f.momentPerFootingLbFt / 20, 6);
    expect(f.converged).toBe(true);
    expect(f.depthFt).toBeGreaterThan(3);
    expect(f.totalVolumeYd3).toBeCloseTo(f.volumePerFootingYd3 * 2, 9);

    // Auto sign weight = 15 psf × 200 sq ft.
    expect(f.signWeightLb).toBe(3000);

    // Seismic: zone 3 → Fp = 0.3·1·2·15 = 9 psf, wind governs.
    expect(r.seismic.fpPsf).toBeCloseTo(9, 9);
    expect(r.seismic.windGoverns).toBe(true);

    expect(r.errors).toEqual([]);
  });

  it('sizes the base plate per the Base Plate sheet formulas', () => {
    const r = computeDesign(baseInput());
    const bp = r.basePlate!;
    const od = 14; // selected pipe OD
    const mPlate = r.momentAtGradeLbFt / 2;

    expect(bp.boltLineSpacingIn).toBe(od + 4);
    expect(bp.plateNIn).toBe(od + 8);
    const T = (mPlate * 12) / (od + 4);
    expect(bp.tensionPerBoltLineLb).toBeCloseTo(T, 4);
    expect(bp.tensionPerAnchorLb).toBeCloseTo(T / 2, 4);
    const mPl = T * 2;
    expect(bp.plateThicknessIn).toBeCloseTo(Math.sqrt((6 * mPl) / (35910 * 2 * 2 * 2)), 6);
    // Auto bolt diameter rounds the minimum up to the next 1/8".
    expect(bp.boltDiaIn).toBeCloseTo(Math.max(0.5, Math.ceil(bp.minBoltDiaIn * 8) / 8), 9);
    expect(bp.minBoltSpacingIn).toBeCloseTo(2 * bp.embedLengthIn, 9);
    // Weld: round pipe → Sw = π r² a.
    expect(bp.weldSectionModulusIn3).toBeCloseTo(Math.PI * 49 * 0.3125, 6);
  });

  it('flags oversized signs instead of silently failing', () => {
    const input = baseInput();
    input.elements = [{ id: 'a', label: 'Huge', widthFt: 60, heightFt: 40, topFt: 60 }];
    input.numColumns = 1;
    const r = computeDesign(input);
    expect(r.column.section).toBeNull();
    expect(r.errors.some((e) => e.includes('No standard pipe/tube size'))).toBe(true);
  });

  it('errors when an element centroid sits below grade', () => {
    const input = baseInput();
    input.elements = [{ id: 'a', label: 'Bad', widthFt: 4, heightFt: 10, topFt: 3 }];
    const r = computeDesign(input);
    expect(r.errors.some((e) => e.includes('below grade'))).toBe(true);
  });

  it('uses the plan diagonal as the effective width for rectangular piers', () => {
    const input = baseInput();
    input.footingType = 'rect';
    input.pierWidthFt = 3;
    input.pierLengthFt = 4;
    const r = computeDesign(input);
    expect(r.footing!.effectiveWidthFt).toBeCloseTo(5, 9);
  });
});
