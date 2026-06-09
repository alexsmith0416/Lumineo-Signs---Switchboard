// Round-trip test for the Sign Builder Pro handoff reader. Constructs a
// realistic v2 payload (matches what app/src/domain/estimateMapping.ts on
// the SBP branch emits for a "Df Routed Cabinet" spec), base64url-encodes
// it, parses it back, and verifies the resulting Project + Pieces are
// well-formed and reference real piece types.

import { describe, it, expect } from 'vitest';
import {
  EXPECTED_VERSION,
  parseSBPPayloadFromHash,
  projectFromPayload,
  type SBPHandoffPayload,
} from '../lib/sbpPayload';
import { getPieceType } from '../data/pieceTypes';

function b64urlEncode(s: string): string {
  // Same encoding the SBP side uses (app/src/data/estimatingService.ts).
  const raw = btoa(unescape(encodeURIComponent(s)));
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hashForPayload(payload: unknown): string {
  return `#import?payload=${b64urlEncode(JSON.stringify(payload))}`;
}

function samplePayload(overrides: Partial<SBPHandoffPayload> = {}): SBPHandoffPayload {
  return {
    version: EXPECTED_VERSION,
    source: 'sign-builder-pro',
    sentAt: '2026-06-08T18:00:00.000Z',
    customerName: 'Westview Medical',
    projectName: 'Main Entry',
    signName: 'Main Entry Cabinet',
    productCode: 'WC-DF-IL-RFPB-P-CV-WB-WH',
    specId: 'spec-westview-001',
    pieces: [
      {
        typeId: 'df-routed-cabinet',
        label: 'Double-face wall sign',
        inputs: { shape: 'Rectangular', extraColors: 0, qty: 1, H: 48, L: 84, D: 12, inchesOfCopy: 0, pushThrough: 'No' },
      },
      {
        typeId: 'led-wiring',
        label: 'LED wiring (WH)',
        inputs: { H: 48, L: 84, qty: 1, ledFamily: 'synergy' },
      },
      {
        typeId: 'vinyl-cutting',
        label: '3M 3630 — 022 Black',
        inputs: { H: 48, L: 84, qty: 1 },
        extraMaterials: [{ itemNo: '3M 3630 — 022 Black', units: 0, description: '3M 3630 — 022 Black' }],
      },
      {
        typeId: 'apply-vinyl-graphics',
        label: 'Apply vinyl',
        inputs: { H: 48, L: 84, qty: 1, surface: 'flat' },
      },
      {
        typeId: 'paint-calculation',
        label: 'Paint — PMS 286 C Navy',
        inputs: { H: 48, L: 84, faces: 2 },
      },
    ],
    ...overrides,
  };
}

describe('parseSBPPayloadFromHash', () => {
  it('decodes a well-formed v2 payload from the URL hash', () => {
    const payload = samplePayload();
    const parsed = parseSBPPayloadFromHash(hashForPayload(payload));
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe(EXPECTED_VERSION);
    expect(parsed!.source).toBe('sign-builder-pro');
    expect(parsed!.pieces).toHaveLength(5);
    expect(parsed!.signName).toBe('Main Entry Cabinet');
  });

  it('also accepts the `#/import?` form (defensive — in case future routing adds a slash)', () => {
    const payload = samplePayload();
    const hash = `#/import?payload=${b64urlEncode(JSON.stringify(payload))}`;
    expect(parseSBPPayloadFromHash(hash)).not.toBeNull();
  });

  it('returns null when the hash is empty', () => {
    expect(parseSBPPayloadFromHash('')).toBeNull();
  });

  it('returns null when the hash is not an import hash', () => {
    expect(parseSBPPayloadFromHash('#some-other-route')).toBeNull();
  });

  it('returns null when the version is wrong', () => {
    const bad = samplePayload({ version: 99 });
    expect(parseSBPPayloadFromHash(hashForPayload(bad))).toBeNull();
  });

  it('returns null when source is not sign-builder-pro', () => {
    const bad = { ...samplePayload(), source: 'not-sbp' };
    expect(parseSBPPayloadFromHash(hashForPayload(bad))).toBeNull();
  });

  it('returns null when payload is malformed JSON', () => {
    expect(parseSBPPayloadFromHash('#import?payload=not-base64')).toBeNull();
  });

  it('returns null when there is no payload param', () => {
    expect(parseSBPPayloadFromHash('#import?')).toBeNull();
  });
});

describe('projectFromPayload', () => {
  it('creates a Project with one Piece per draft, each with a unique id', () => {
    const payload = samplePayload();
    const project = projectFromPayload(payload);
    expect(project.pieces).toHaveLength(5);
    expect(project.jobName).toBe('Main Entry Cabinet');
    // description carries the cross-app linkage so the estimator sees what came in.
    expect(project.description).toContain('Spec: WC-DF-IL-RFPB-P-CV-WB-WH');
    expect(project.description).toContain('SBP id: spec-westview-001');
    const ids = new Set(project.pieces.map((p) => p.id));
    expect(ids.size).toBe(5);
  });

  it('every piece typeId resolves through getPieceType so the engine can compute', () => {
    const project = projectFromPayload(samplePayload());
    for (const piece of project.pieces) {
      expect(getPieceType(piece.typeId), `unknown typeId: ${piece.typeId}`).toBeDefined();
    }
  });

  it('preserves the per-piece-type input vocabulary (H, L, qty, surface, faces, etc.)', () => {
    const project = projectFromPayload(samplePayload());

    const cabinet = project.pieces.find((p) => p.typeId === 'df-routed-cabinet')!;
    expect(cabinet.inputs.H).toBe(48);
    expect(cabinet.inputs.L).toBe(84);
    expect(cabinet.inputs.D).toBe(12);
    expect(cabinet.inputs.pushThrough).toBe('No');

    const led = project.pieces.find((p) => p.typeId === 'led-wiring')!;
    expect(led.inputs.ledFamily).toBe('synergy');

    const apply = project.pieces.find((p) => p.typeId === 'apply-vinyl-graphics')!;
    expect(apply.inputs.surface).toBe('flat');

    const paint = project.pieces.find((p) => p.typeId === 'paint-calculation')!;
    expect(paint.inputs.faces).toBe(2);
  });

  it('forwards pre-filled extraMaterials so vinyl color hints survive', () => {
    const project = projectFromPayload(samplePayload());
    const vinyl = project.pieces.find((p) => p.typeId === 'vinyl-cutting')!;
    expect(vinyl.extraMaterials).toHaveLength(1);
    expect(vinyl.extraMaterials![0].description).toBe('3M 3630 — 022 Black');
  });

  it('drops pieces with unknown typeIds so a future SBP type addition does not break the import', () => {
    const payload = samplePayload({
      pieces: [
        { typeId: 'made-up-future-piece', inputs: { H: 1, L: 1 } },
        { typeId: 'df-routed-cabinet', inputs: { qty: 1, H: 24, L: 36, D: 6 } },
      ],
    });
    const project = projectFromPayload(payload);
    expect(project.pieces).toHaveLength(1);
    expect(project.pieces[0].typeId).toBe('df-routed-cabinet');
  });

  it('falls back jobName to projectName when signName is absent', () => {
    const payload = samplePayload({ signName: undefined, projectName: 'Lakeside Phase 1' });
    expect(projectFromPayload(payload).jobName).toBe('Lakeside Phase 1');
  });

  it('falls back jobName to productCode when both names are absent', () => {
    const payload = samplePayload({ signName: undefined, projectName: undefined, productCode: 'MN-SF-EL-AT' });
    expect(projectFromPayload(payload).jobName).toBe('MN-SF-EL-AT');
  });
});

describe('SBP → Estimating round trip — engine readiness', () => {
  it('every piece produced by projectFromPayload can be computed without throwing', async () => {
    const { computePiece } = await import('../lib/engine');
    const project = projectFromPayload(samplePayload());
    for (const piece of project.pieces) {
      // computePiece throws on unknown typeId; this proves every imported
      // piece can drop straight into the engine.
      expect(() => computePiece(piece)).not.toThrow();
    }
  });
});
