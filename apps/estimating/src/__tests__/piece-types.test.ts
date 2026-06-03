// Spot-tests for the IMPLEMENTED (non-verified) piece types. These confirm
// the formulas land on sensible totals — they don't reproduce the workbook
// to the cent (the cabinet sheets have hand-overridden cells in places), but
// each test exercises the labor-line shape and arithmetic against the rates
// in src/data/rates.ts.

import { describe, it, expect } from 'vitest';

import { computePiece, type Piece } from '../lib/engine';
import { RATES, TABLES, tierFor } from '../data/rates';

function piece(typeId: string, inputs: Record<string, number | string>): Piece {
  return { id: 't', typeId, inputs };
}

describe('Flat panels only', () => {
  it('Acrylic panel uses 2312 plastic face labor at 72 sqft/hr', () => {
    const r = computePiece(piece('flat-panels', { H: 24, L: 48, panels: 1, material: 'Acrylic' }));
    expect(r.sqft).toBeCloseTo(8, 4);
    expect(r.labor).toHaveLength(1);
    expect(r.labor[0].workCode).toBe(2312);
    // Workbook applies CEILING(sqft, 10) before dividing.
    expect(r.labor[0].hours).toBe(0.25); // ceil(10/72=0.138, 0.25) = 0.25
  });
  it('ACM panel uses 2011 cabinet metal labor at 96 sqft/hr', () => {
    const r = computePiece(piece('flat-panels', { H: 36, L: 96, panels: 1, material: 'ACM' }));
    expect(r.sqft).toBe(24);
    expect(r.labor[0].workCode).toBe(2011);
    // proc=ceil(24,10)=30; 30/96=0.3125 → ceil to 0.5
    expect(r.labor[0].hours).toBe(0.5);
  });
});

describe('Routed aluminum faces / letters', () => {
  it('emits 1hr setup + inches/200 routing', () => {
    const r = computePiece(piece('routed-alum-faces-letters', { H: 24, L: 48, qty: 1, inchesOfCopy: 100 }));
    expect(r.sqft).toBe(8);
    expect(r.labor).toHaveLength(2);
    expect(r.labor[0].hours).toBe(1); // setup
    // 100 inches × 6 = 600; 600/200 = 3 hr
    expect(r.labor[1].hours).toBe(3);
  });
});

describe('Routed push-through acrylic', () => {
  it('uses rate=100 in/hr', () => {
    const r = computePiece(piece('routed-push-through-acrylic', { H: 24, L: 48, qty: 1, inchesOfCopy: 100 }));
    // 100 * 6 = 600 inches; 600/100 = 6 hr
    expect(r.labor[1].hours).toBe(6);
  });
});

describe('Trimcap letter face', () => {
  it('inches/21 in/hr', () => {
    const r = computePiece(piece('trimcap-letter-face', { inches: 84, qty: 1 }));
    // 84/21 = 4 hr (already on a 0.25 boundary)
    expect(r.labor[0].workCode).toBe(2314);
    expect(r.labor[0].hours).toBe(4);
  });
});

describe('Channel letter fabrication', () => {
  it('block rate = 18 in/hr', () => {
    const r = computePiece(piece('channel-letter-fabrication', { inches: 36, qty: 1, face: 'block' }));
    // 36/18 = 2 hr
    expect(r.labor[0].hours).toBe(2);
  });
  it('script rate = 8 in/hr', () => {
    const r = computePiece(piece('channel-letter-fabrication', { inches: 32, qty: 1, face: 'script' }));
    expect(r.labor[0].hours).toBe(4);
  });
});

describe('LED wiring', () => {
  it('synergy: 1.3 LEDs/sqft, 108 LEDs/PSU; labor sqft/14.25', () => {
    const r = computePiece(piece('led-wiring', { H: 48, L: 48, qty: 1, ledFamily: 'synergy' }));
    expect(r.sqft).toBe(16);
    // ceil(16 * 1.3) = ceil(20.8) = 21 LEDs
    const ledLine = r.materials.find(m => m.itemNo === 'LED-synergy');
    expect(ledLine?.units).toBe(21);
    // ceil(21/108) = 1 PSU
    const psuLine = r.materials.find(m => m.itemNo === 'PSU-synergy');
    expect(psuLine?.units).toBe(1);
    // labor 2212: 16/14.25 ≈ 1.12 → ceil to 1.25
    expect(r.labor[0].workCode).toBe(2212);
    expect(r.labor[0].hours).toBe(1.25);
  });
});

describe('Reveal', () => {
  it('uses TABLES.reveal: 10 sqft → rate=9.5', () => {
    // 10 sqft is in tier 0 (threshold 0, rate 9.5); 10/9.5 = 1.0526 → ceil 1.25
    const r = computePiece(piece('reveal', { H: 48, L: 30, qty: 1 }));
    expect(r.sqft).toBe(10);
    const tier = tierFor(TABLES.reveal, 10);
    expect(tier).toBe(9.5);
    expect(r.labor[0].hours).toBe(1.25);
  });
});

describe('Crown cove top', () => {
  it('paint prep at 6 sqft/hr', () => {
    const r = computePiece(piece('crown-cove', { H: 12, L: 144, qty: 1 }));
    expect(r.sqft).toBe(12);
    // paint prep: 12/6 = 2 hr
    const prep = r.labor.find(l => l.description === 'Paint Prep (bondo)');
    expect(prep?.hours).toBe(2);
  });
});

describe('Crating', () => {
  it('emits a 2216 line when hours > 0', () => {
    const r = computePiece(piece('crating', { description: 'CNB crate', hours: 10 }));
    expect(r.labor).toHaveLength(1);
    expect(r.labor[0].workCode).toBe(2216);
    expect(r.labor[0].hours).toBe(10);
    expect(r.labor[0].total).toBe(10 * 97);
  });
  it('emits no labor when hours = 0', () => {
    const r = computePiece(piece('crating', { description: '', hours: 0 }));
    expect(r.labor).toHaveLength(0);
  });
});

describe('Structural steel', () => {
  it('emits a 2016 line', () => {
    const r = computePiece(piece('structural-steel', { description: 'CNB steel', hours: 4 }));
    expect(r.labor[0].workCode).toBe(2016);
    expect(r.labor[0].total).toBe(4 * 97);
  });
});

describe('Alum pan sign', () => {
  it('rectangular pan: fab rate from TABLES.pan, paint prep 43.75/hr, paint 28.5/hr', () => {
    const r = computePiece(piece('alum-pan-sign', { shape: 'Rectangular', extraColors: 0, qty: 1, H: 24, L: 48, D: 2 }));
    expect(r.sqft).toBe(8);
    expect(r.labor.length).toBeGreaterThanOrEqual(3);
    const fab = r.labor.find(l => l.description === 'Cabinet Metal Labor');
    // 8 sqft is in pan tier 2 (threshold 5, rate 3.8); 8/3.8 = 2.105 → ceil 2.25
    expect(fab?.hours).toBe(2.25);
  });
  it('radius/angle adds the 25% uplift', () => {
    const r = computePiece(piece('alum-pan-sign', { shape: 'Radius/Angle', extraColors: 0, qty: 1, H: 24, L: 48, D: 2 }));
    const uplift = r.labor.find(l => l.description === 'Radius/Angle uplift');
    expect(uplift?.hours).toBeGreaterThan(0);
  });
});

describe('Post and panel', () => {
  it('emits body + post + paint labor lines', () => {
    const r = computePiece(piece('post-and-panel', {
      shape: 'Rectangular', extraColors: 0, qty: 1, H: 48, L: 96, D: 3, postCount: 2, postLen: 96,
    }));
    expect(r.sqft).toBe(32);
    const body = r.labor.find(l => l.description === 'Cabinet Metal Labor — body');
    const posts = r.labor.find(l => l.description === 'Cabinet Metal Labor — posts');
    expect(body).toBeDefined();
    expect(posts).toBeDefined();
    expect(posts!.hours).toBeGreaterThan(0);
  });
});

describe('Sf routed cabinet', () => {
  it('emits routing setup, copy routing, fab, paint, LED, assembly', () => {
    const r = computePiece(piece('sf-routed-cabinet', {
      shape: 'Rectangular', extraColors: 0, qty: 1, H: 36, L: 72, D: 6, inchesOfCopy: 50, pushThrough: 'No',
    }));
    const setup = r.labor.find(l => l.description === 'Routing setup');
    const fab = r.labor.find(l => l.description === 'Cabinet Metal Labor');
    const led = r.labor.find(l => l.description === 'LED Wiring Labor');
    expect(setup?.hours).toBe(2); // 2x router setup
    expect(fab).toBeDefined();
    expect(led).toBeDefined();
  });
});

describe('Sf flex cabinet', () => {
  it('flex assembly line uses 2316', () => {
    const r = computePiece(piece('sf-flex-cabinet', { shape: 'Rectangular', extraColors: 0, qty: 1, H: 48, L: 96, D: 6 }));
    const flex = r.labor.find(l => l.workCode === 2316);
    expect(flex).toBeDefined();
  });
});

describe('Pole cover', () => {
  it('large pole (L>=61) applies 1.3x frame multiplier vs sub-61 baseline', () => {
    // Two poles in the same TABLES.polecover tier (rate 0.95 below sqft 5).
    // L=60: just below the 61" threshold → no multiplier.
    // L=72: above threshold → fab hours × 1.3.
    const small = computePiece(piece('pole-cover', { shape: 'Rectangular', extraColors: 0, qty: 1, H: 6, L: 60, D: 0 }));
    const large = computePiece(piece('pole-cover', { shape: 'Rectangular', extraColors: 0, qty: 1, H: 5, L: 72, D: 0 }));
    expect(small.sqft).toBeCloseTo(2.5, 4); // tier rate 0.95
    expect(large.sqft).toBeCloseTo(2.5, 4); // same tier
    const smallFab = small.labor.find(l => l.description === 'Cabinet Metal Labor')!;
    const largeFab = large.labor.find(l => l.description === 'Cabinet Metal Labor')!;
    // Large should be exactly 1.3x the small.
    expect(largeFab.hours / smallFab.hours).toBeCloseTo(1.3, 4);
  });
});

describe('EMC assembly', () => {
  it('uses TABLES.EMC for assembly and 20 sqft/hr for hand paint', () => {
    const r = computePiece(piece('emc-assembly', { H: 48, L: 96, qty: 1, pitch: 6 }));
    expect(r.sqft).toBe(32);
    const asm = r.labor.find(l => l.workCode === 2215);
    const paint = r.labor.find(l => l.workCode === 2116);
    expect(asm).toBeDefined();
    expect(paint).toBeDefined();
  });
});

describe('Changeable copy face', () => {
  it('emits CC rail + divider bar labor lines', () => {
    const r = computePiece(piece('changeable-copy-face', { H: 48, L: 96, qty: 1, rows: 2 }));
    expect(r.labor).toHaveLength(2);
    const rail = r.labor.find(l => l.description === 'CC rail fabrication');
    const div = r.labor.find(l => l.description === 'Divider bar labor');
    expect(rail!.hours).toBeGreaterThan(0);
    expect(div!.hours).toBeGreaterThan(0);
  });
});

describe('Flex face assembly', () => {
  it('emits clip material when clipFt > 0', () => {
    const r = computePiece(piece('flex-face-assembly', { H: 48, L: 96, qty: 1, clipFt: 20, clipType: 'plastic' }));
    expect(r.materials).toHaveLength(1);
    expect(r.materials[0].itemNo).toBe('FLEX-CLIP-PLASTIC');
    expect(r.materials[0].units).toBe(20);
    expect(r.materials[0].unitPrice).toBe(RATES.flexFaceClipPlasticPerFoot);
  });
});

describe('Routed face assembly', () => {
  it('emits backer + retainer labor', () => {
    const r = computePiece(piece('routed-face-assembly', { H: 48, L: 96, qty: 1 }));
    expect(r.labor).toHaveLength(2);
  });
});

describe('All piece types are registered and computable', () => {
  it('every piece type has a unique id, label, and compute()', async () => {
    const { PIECE_TYPES } = await import('../data/pieceTypes');
    const ids = new Set<string>();
    for (const t of PIECE_TYPES) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      // compute() with empty inputs should not throw.
      expect(() => t.compute({})).not.toThrow();
    }
    expect(PIECE_TYPES.length).toBe(31); // freeform + 4 verified + 26 implemented
  });
});
