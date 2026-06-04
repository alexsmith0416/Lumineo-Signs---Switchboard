// CNB acceptance test — the build's reconciliation contract.
//
// The CNB filled workbook (reference/estimating/Sign365 LN Estimate - CNB.xlsx,
// Job J36938) is the canonical "this is what an estimate looks like when it
// agrees with Business Central" fixture. Materials and labor below are
// transcribed verbatim from its BCI + BCL sheets (the BC import shape). This
// test feeds them through the engine's aggregation and asserts the total
// matches what the workbook produces to the cent.
//
// CNB replaces the MERITRUST J35260 / $11,474.35 target referenced in the
// original spec (docs/16-estimating.md) — the user swapped to CNB because it
// is larger and more complex. Per the workbook:
//
//   BCI material subtotal $12,637.205
//   BCL labor subtotal    $17,393.3125   (11 lines × $97/hr)
//   Total                 $30,030.5175  → $30,030.52 to the cent
//
// Note on materials: BCI rows in the workbook include `Profit %` and
// `Unit Cost`, but the line total is Unit Price × Quantity. The engine
// computes the same way.

import { describe, it, expect } from 'vitest';

import {
  aggregateForBC,
  computeProject,
  round4,
  type Project,
  type Piece,
} from '../lib/engine';
import type { ComputedMaterialLine, ComputedLaborLine } from '../data/pieceTypes';
import { CNB_SAMPLE_ESTIMATE } from '../data/sampleEstimate';

// CNB BCI sheet — 20 material lines from Sign365 LN Estimate - CNB.xlsx.
const CNB_MATERIALS: readonly ComputedMaterialLine[] = [
  { itemNo: '13090', description: "ACM 4'x 8' LED Grade", units: 3.5, unitCost: 61.805, unitPrice: 111.26, profitPct: 44.45 },
  { itemNo: '15456', description: '48" 3630-20 White', units: 52, unitCost: 1.968, unitPrice: 3.543, profitPct: 44.45 },
  { itemNo: '19120', description: '48" 3635-70 Wht Diffuser 70%', units: 52, unitCost: 1.25, unitPrice: 2.25, profitPct: 44.45 },
  { itemNo: '20050', description: "2x2x.187 SqCrnrArcAl Ang 20'", units: 270, unitCost: 3.444, unitPrice: 6.2, profitPct: 44.45 },
  { itemNo: '22030', description: 'ZF .188 Retainer', units: 40, unitCost: 2.557, unitPrice: 4.603, profitPct: 44.45 },
  { itemNo: '24036', description: '.063 Black Alum', units: 60, unitCost: 4.214, unitPrice: 7.586, profitPct: 44.45 },
  { itemNo: '24055', description: '.090 Mil Alum 3003', units: 300, unitCost: 4.187, unitPrice: 7.537, profitPct: 44.45 },
  { itemNo: '24065', description: 'Routing - .125 Mil Alum 5052', units: 100, unitCost: 5.516, unitPrice: 9.93, profitPct: 44.45 },
  { itemNo: '25050', description: "3 x .125 Arch Alum Sq Tube 24'", units: 60, unitCost: 6.448, unitPrice: 11.608, profitPct: 44.45 },
  { itemNo: '28050', description: '2 X 2 X .187 Angle Iron', units: 90, unitCost: 1.639, unitPrice: 2.95, profitPct: 44.45 },
  { itemNo: '44350', description: 'SLOAN 24VDC 100W POWER SUPPLY', units: 2, unitCost: 36.083, unitPrice: 64.956, profitPct: 44.45 },
  { itemNo: '44750', description: 'Sloan Prism Synergy Spec 24V', units: 130, unitCost: 1.829, unitPrice: 3.293, profitPct: 44.45 },
  { itemNo: '53045', description: '.500 Clear Plex', units: 112, unitCost: 8.789, unitPrice: 15.822, profitPct: 44.45 },
  { itemNo: '75005', description: 'Red Oxide Primer', units: 3, unitCost: 7.625, unitPrice: 13.726, profitPct: 44.45 },
  { itemNo: '75055', description: '3" Fuzzy Paint Roller', units: 2, unitCost: 1.558, unitPrice: 2.805, profitPct: 44.45 },
  { itemNo: '75090', description: '3" Paint Brush', units: 2, unitCost: 0.68, unitPrice: 1.224, profitPct: 44.45 },
  { itemNo: '75135', description: '2" Chip Brush', units: 1, unitCost: 0.673, unitPrice: 1.212, profitPct: 44.45 },
  { itemNo: 'EST ELECTRICAL', description: 'Estimate for Misc Electrical Materials', units: 100, unitCost: 0, unitPrice: 1, profitPct: 0 },
  { itemNo: 'EST HARDWARE-ADHESIV', description: 'Estimate for Misc Hardware & Adhesive Materials', units: 223.5, unitCost: 0, unitPrice: 3, profitPct: 0 },
  { itemNo: 'EST PAINT - CUSTOM', description: 'Estimate for Custom Paint Color', units: 44435, unitCost: 0.02856, unitPrice: 0.051, profitPct: 44.45 },
];

// CNB BCL sheet — 11 labor lines, all priced at the post-1-1-26 $97/hr rate.
const CNB_LABOR: readonly ComputedLaborLine[] = [
  { workCode: 2010, hours: 28.25 },
  { workCode: 2011, hours: 57.5625 },
  { workCode: 2016, hours: 4 },
  { workCode: 2110, hours: 25.5 },
  { workCode: 2112, hours: 19.25 },
  { workCode: 2116, hours: 2.5 },
  { workCode: 2212, hours: 7.25 },
  { workCode: 2215, hours: 18.75 },
  { workCode: 2216, hours: 10.75 },
  { workCode: 2313, hours: 1.75 },
  { workCode: 2416, hours: 3.75 },
];

const CNB_FIXTURE: Project = {
  id: 'cnb',
  jobNumber: 'J36938',
  jobName: 'CNB',
  estimator: 'Workbook',
  description: 'Filled CNB job — acceptance fixture transcribed from the workbook BCI + BCL sheets.',
  pieces: [
    {
      id: 'cnb-aggregate',
      typeId: 'freeform-tm',
      label: 'CNB — full job (BCI + BCL transcribed)',
      inputs: { description: 'CNB transcribed' },
      extraMaterials: CNB_MATERIALS,
      extraLabor: CNB_LABOR,
    },
  ],
};

const EXPECTED_MATERIAL_TOTAL = 12637.205;
const EXPECTED_LABOR_TOTAL = 17393.3125;
const EXPECTED_TOTAL = 30030.5175;

describe('CNB acceptance — J36938 reconciles to the workbook', () => {
  it('material total is $12,637.205 (BCI subtotal)', () => {
    const cp = computeProject(CNB_FIXTURE);
    expect(round4(cp.materialTotal)).toBe(EXPECTED_MATERIAL_TOTAL);
  });

  it('labor total is $17,393.3125 (BCL subtotal at $97/hr)', () => {
    const cp = computeProject(CNB_FIXTURE);
    expect(round4(cp.laborTotal)).toBe(EXPECTED_LABOR_TOTAL);
  });

  it('project total reconciles to $30,030.52', () => {
    const cp = computeProject(CNB_FIXTURE);
    expect(round4(cp.total)).toBe(EXPECTED_TOTAL);
    expect(Number(cp.total.toFixed(2))).toBe(30030.52);
  });

  it('BC aggregator produces a BCI line per material and a BCL line per work code', () => {
    const bc = aggregateForBC(CNB_FIXTURE);
    expect(bc.bci).toHaveLength(CNB_MATERIALS.length);
    expect(bc.bcl).toHaveLength(CNB_LABOR.length);
    expect(bc.total).toBe(EXPECTED_TOTAL);
  });

  it('aggregator collapses duplicate item numbers and work codes', () => {
    const dupProject: Project = {
      ...CNB_FIXTURE,
      pieces: [
        {
          id: 'a',
          typeId: 'freeform-tm',
          inputs: {},
          extraMaterials: [{ itemNo: 'TEST', units: 2, unitPrice: 5, unitCost: 3, profitPct: 40 }],
          extraLabor: [{ workCode: 2010, hours: 1 }],
        },
        {
          id: 'b',
          typeId: 'freeform-tm',
          inputs: {},
          extraMaterials: [{ itemNo: 'TEST', units: 3, unitPrice: 5, unitCost: 3, profitPct: 40 }],
          extraLabor: [{ workCode: 2010, hours: 2 }],
        },
      ],
    };
    const bc = aggregateForBC(dupProject);
    expect(bc.bci).toHaveLength(1);
    expect(bc.bci[0].quantity).toBe(5);
    expect(bc.bcl).toHaveLength(1);
    expect(bc.bcl[0].runTime).toBe(3);
  });
});

// The seeded sample (CNB_SAMPLE_ESTIMATE) is the same J36938 job broken out
// one-piece-per-worksheet rather than as a single transcribed aggregate. It
// must reconcile to the identical total and produce the identical BC import.
describe('CNB sample estimate — per-piece breakdown matches the aggregate', () => {
  it('reconciles to $30,030.52', () => {
    const cp = computeProject(CNB_SAMPLE_ESTIMATE);
    expect(round4(cp.materialTotal)).toBe(EXPECTED_MATERIAL_TOTAL);
    expect(round4(cp.laborTotal)).toBe(EXPECTED_LABOR_TOTAL);
    expect(round4(cp.total)).toBe(EXPECTED_TOTAL);
    expect(Number(cp.total.toFixed(2))).toBe(30030.52);
  });

  it('aggregates to the same BCI lines and quantities as the fixture', () => {
    const sample = aggregateForBC(CNB_SAMPLE_ESTIMATE);
    const fixture = aggregateForBC(CNB_FIXTURE);
    expect(sample.bci).toHaveLength(CNB_MATERIALS.length);
    const sampleQty = Object.fromEntries(sample.bci.map(r => [r.itemNumber, round4(r.quantity)]));
    const fixtureQty = Object.fromEntries(fixture.bci.map(r => [r.itemNumber, round4(r.quantity)]));
    expect(sampleQty).toEqual(fixtureQty);
  });

  it('aggregates to the same BCL resources and hours as the fixture', () => {
    const sample = aggregateForBC(CNB_SAMPLE_ESTIMATE);
    const fixture = aggregateForBC(CNB_FIXTURE);
    expect(sample.bcl).toHaveLength(CNB_LABOR.length);
    const sampleHrs = Object.fromEntries(sample.bcl.map(r => [r.resourceNumber, round4(r.runTime)]));
    const fixtureHrs = Object.fromEntries(fixture.bcl.map(r => [r.resourceNumber, round4(r.runTime)]));
    expect(sampleHrs).toEqual(fixtureHrs);
  });
});
