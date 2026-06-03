// Unit tests for the four piece-type formulas that the build spec
// (docs/16-estimating.md) explicitly anchors. These are the contracts every
// future encode-the-rest-of-the-types work has to keep passing.

import { describe, it, expect } from 'vitest';

import { computePiece, type Piece, round4 } from '../lib/engine';

function piece(typeId: string, inputs: Record<string, number | string>): Piece {
  return { id: 't-' + typeId, typeId, inputs };
}

// ---------------------------------------------------------------------------
// Apply Vinyl Graphics
// sqft = (H * L / 144) * qty
// labor 2416 hours = CEILING(sqft / (Flat 32 | PushThrough 15), 0.5)
// ---------------------------------------------------------------------------
describe('Apply vinyl graphics', () => {
  it('flat: 24" × 36" × 1 → 6 sqft, ceil(6/32 = 0.1875, 0.5) = 0.5 hrs at $97 = $48.50', () => {
    const r = computePiece(piece('apply-vinyl-graphics', { H: 24, L: 36, qty: 1, surface: 'flat' }));
    expect(r.sqft).toBe(6);
    expect(r.labor).toHaveLength(1);
    expect(r.labor[0].workCode).toBe(2416);
    expect(r.labor[0].hours).toBe(0.5);
    expect(r.labor[0].hourlyRate).toBe(97);
    expect(r.labor[0].total).toBe(48.5);
    expect(r.materialTotal).toBe(0);
    expect(r.total).toBe(48.5);
  });

  it('push-through: 48" × 48" × 1 → 16 sqft, ceil(16/15 = 1.066, 0.5) = 1.5 hrs', () => {
    const r = computePiece(piece('apply-vinyl-graphics', { H: 48, L: 48, qty: 1, surface: 'push-through' }));
    expect(r.sqft).toBe(16);
    expect(r.labor[0].hours).toBe(1.5);
    expect(r.labor[0].total).toBe(round4(1.5 * 97));
  });

  it('qty multiplies sqft (2 panels of 12" × 12" → 2 sqft)', () => {
    const r = computePiece(piece('apply-vinyl-graphics', { H: 12, L: 12, qty: 2, surface: 'flat' }));
    expect(r.sqft).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Vinyl Cutting
// sqft = CEILING((H * L) / 144, 4) * qty
// labor 2415 hours = CEILING(sqft / 20, 0.25)
// ---------------------------------------------------------------------------
describe('Vinyl cutting', () => {
  it('12" × 12" × 1 → raw 1 sqft, ceil(1, 4) = 4 sqft', () => {
    const r = computePiece(piece('vinyl-cutting', { H: 12, L: 12, qty: 1 }));
    expect(r.sqft).toBe(4);
    expect(r.labor[0].workCode).toBe(2415);
    // 4 / 20 = 0.2 → ceil to 0.25
    expect(r.labor[0].hours).toBe(0.25);
    expect(r.labor[0].total).toBe(round4(0.25 * 97));
  });

  it('48" × 48" × 2 → raw 16 sqft per, ceil(16, 4) × 2 = 32 sqft, ceil(32/20, 0.25) = 1.75 hrs', () => {
    const r = computePiece(piece('vinyl-cutting', { H: 48, L: 48, qty: 2 }));
    expect(r.sqft).toBe(32);
    expect(r.labor[0].hours).toBe(1.75);
  });

  it('zero dimensions zero everything', () => {
    const r = computePiece(piece('vinyl-cutting', { H: 0, L: 0, qty: 1 }));
    expect(r.sqft).toBe(0);
    expect(r.labor[0].hours).toBe(0);
    expect(r.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Paint Calculation
// sqft = (H * L / 144) * faces
// material EST PAINT - CUSTOM = ROUND(sqft * 100) grams
// labor 2110 hours = sqft / 20 ; labor 2112 hours = sqft / 25
// ---------------------------------------------------------------------------
describe('Paint calculation', () => {
  it('48" × 48" × 2 faces → 32 sqft, 3200g paint, 1.6 + 1.28 hrs', () => {
    const r = computePiece(piece('paint-calculation', { H: 48, L: 48, faces: 2 }));
    expect(r.sqft).toBe(32);
    expect(r.materials).toHaveLength(1);
    expect(r.materials[0].itemNo).toBe('EST PAINT - CUSTOM');
    expect(r.materials[0].units).toBe(3200);
    expect(r.labor).toHaveLength(2);
    const prep = r.labor.find(l => l.workCode === 2110)!;
    const paint = r.labor.find(l => l.workCode === 2112)!;
    expect(prep.hours).toBeCloseTo(1.6, 4);
    expect(paint.hours).toBeCloseTo(1.28, 4);
    // unit price 0.051 × 3200 = 163.20
    expect(r.materials[0].total).toBe(163.2);
  });

  it('zero area yields no paint line', () => {
    const r = computePiece(piece('paint-calculation', { H: 0, L: 0, faces: 1 }));
    expect(r.materials).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Routed Panel Shapes
// sqft = (H * L / 144) * panels
// labor 2010 setup 1 hr + 2010 routing hours = sqft / 50
// ---------------------------------------------------------------------------
describe('Routed panel shapes', () => {
  it('72" × 48" × 1 panel → 24 sqft, 1 hr setup + 0.48 hr routing = 1.48 hrs at $97 = $143.56', () => {
    const r = computePiece(piece('routed-panel-shapes', { H: 72, L: 48, panels: 1 }));
    expect(r.sqft).toBe(24);
    expect(r.labor).toHaveLength(2);
    const setup = r.labor[0];
    const routing = r.labor[1];
    expect(setup.workCode).toBe(2010);
    expect(setup.hours).toBe(1);
    expect(routing.workCode).toBe(2010);
    expect(routing.hours).toBeCloseTo(0.48, 4);
    expect(r.laborTotal).toBeCloseTo(round4(1.48 * 97), 4);
  });

  it('multiple panels multiply area', () => {
    const r = computePiece(piece('routed-panel-shapes', { H: 36, L: 36, panels: 4 }));
    expect(r.sqft).toBe(36); // 9 × 4
  });
});
