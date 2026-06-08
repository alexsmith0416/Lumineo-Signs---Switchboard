// Sign Builder Pro → Estimating URL handoff reader.
//
// Sign Builder Pro fires `window.open('https://estimating.lumineosigns.com/
// #import?payload=<base64url-json>')` from its Builder's “Send to
// Estimating” button. This module owns the matching reader on the
// Estimating side: parse the hash, validate the payload, and convert
// the SBP `EstimatingPieceDraft[]` into our `Piece[]` + a `Project`.
//
// Source of truth: docs/estimating-integration.md on the SBP branch
// `claude/sign-builder-power-apps-sASaA`. Bump our `EXPECTED_VERSION`
// when the SBP side bumps its `ESTIMATING_PAYLOAD_VERSION`.

import type { Piece, Project } from './engine';
import type { ComputedLaborLine, ComputedMaterialLine } from '../data/pieceTypes';
import { getPieceType } from '../data/pieceTypes';

export const EXPECTED_VERSION = 2;

/** Shape of an SBP piece-draft. Mirrors EstimatingPieceDraft in
 *  app/src/domain/estimateMapping.ts on the SBP branch. We accept it
 *  permissively (Piece extras keyed loosely) so future additions on
 *  the SBP side don't fail validation here. */
interface SBPPieceDraft {
  typeId: string;
  label?: string;
  inputs: Record<string, number | string>;
  extraMaterials?: Array<{ itemNo: string; units: number; description?: string }>;
  extraLabor?: Array<{ workCode: number; hours: number; description?: string }>;
}

export interface SBPHandoffPayload {
  version: number;
  source: 'sign-builder-pro';
  sentAt?: string;
  specId?: string;
  jobId?: string;
  opportunityId?: string;
  customerName?: string;
  projectName?: string;
  signName?: string;
  productCode?: string;
  notes?: string;
  pieces: SBPPieceDraft[];
}

/**
 * Parse + validate a payload from `window.location.hash`. Returns null
 * on any failure (missing param, bad encoding, wrong version) — the
 * caller boots normally with no imported project.
 */
export function parseSBPPayloadFromHash(hash: string = window.location.hash): SBPHandoffPayload | null {
  if (!hash) return null;
  // Hash forms accepted:
  //   '#import?payload=...'   ← the SBP default
  //   '#/import?payload=...'  ← in case future routing adds a slash
  const m = /^#\/?import\?(.+)$/.exec(hash);
  if (!m) return null;
  const params = new URLSearchParams(m[1]);
  const raw = params.get('payload');
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(b64urlDecode(raw));
  } catch (err) {
    console.warn('[sbpPayload] failed to decode payload', err);
    return null;
  }
  if (!isPayload(parsed)) {
    console.warn('[sbpPayload] payload shape failed validation', parsed);
    return null;
  }
  if (parsed.version !== EXPECTED_VERSION) {
    console.warn(
      `[sbpPayload] version mismatch — expected ${EXPECTED_VERSION}, got ${parsed.version}`,
    );
    return null;
  }
  return parsed;
}

/**
 * Convert an SBP payload into a Project ready to drop into the app.
 * Each draft piece becomes a Piece with a fresh id; the project header
 * is seeded from the payload's customer / sign / project fields.
 */
export function projectFromPayload(payload: SBPHandoffPayload): Project {
  const projectId = `est-sbp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const pieces: Piece[] = payload.pieces
    .filter((p) => getPieceType(p.typeId) != null)
    .map((draft, idx) => pieceFromDraft(draft, projectId, idx));

  const jobName =
    payload.signName ?? payload.projectName ?? payload.productCode ?? 'Imported from Sign Builder Pro';
  const description = [
    payload.productCode ? `Spec: ${payload.productCode}` : '',
    payload.specId ? `SBP id: ${payload.specId}` : '',
    payload.jobId ? `Job: ${payload.jobId}` : '',
    payload.opportunityId ? `Opportunity: ${payload.opportunityId}` : '',
    payload.notes ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: projectId,
    jobNumber: '', // estimator fills this in (J####)
    jobName,
    estimator: '',
    description,
    pieces,
  };
}

function pieceFromDraft(draft: SBPPieceDraft, projectId: string, idx: number): Piece {
  return {
    id: `${projectId}-piece-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    typeId: draft.typeId,
    label: draft.label,
    inputs: draft.inputs,
    extraMaterials: draft.extraMaterials?.map<ComputedMaterialLine>((m) => ({
      itemNo: m.itemNo,
      units: m.units,
      description: m.description,
    })),
    extraLabor: draft.extraLabor?.map<ComputedLaborLine>((l) => ({
      workCode: l.workCode,
      hours: l.hours,
      description: l.description,
    })),
  };
}

/** Strip the import payload from the URL so a page refresh doesn't
 *  re-create the project. Uses history.replaceState so back / forward
 *  history stays clean. */
export function clearImportHash(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const { origin, pathname, search } = window.location;
  window.history.replaceState(null, '', origin + pathname + search);
}

// ─── helpers ────────────────────────────────────────────────────────────────────────

function isPayload(v: unknown): v is SBPHandoffPayload {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.version === 'number' &&
    p.source === 'sign-builder-pro' &&
    Array.isArray(p.pieces)
  );
}

/** base64url → string. Mirrors the encoder in
 *  app/src/data/estimatingService.ts (b64urlEncode). */
function b64urlDecode(s: string): string {
  // Pad back to a multiple of 4 for atob().
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const padFull = padded + '='.repeat(padLen);
  return decodeURIComponent(escape(atob(padFull)));
}
