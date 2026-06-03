// Sign Builder Pro import — stub. Accepts an SBP sign spec and returns a
// pre-filled Piece. The real SBP wire-up (auth, fetch, schema validation) is
// tracked separately; for now this maps the handful of fields that overlap
// with the Estimating piece-type inputs.

import type { Piece } from './engine';
import { getPieceType } from '../data/pieceTypes';

/** Approximation of the SBP sign-spec shape. Only the fields we actually use
 *  today are typed — the real schema lives in the Sign Builder Pro project. */
export interface SBPSignSpec {
  /** SBP's category for the sign — drives piece-type mapping. */
  readonly category: string;
  readonly heightIn?: number;
  readonly lengthIn?: number;
  readonly qty?: number;
  readonly faces?: number;
  readonly panels?: number;
  /** Vinyl material item number (matches the Estimating catalog). */
  readonly vinylItemNo?: string;
  /** Optional pre-computed sqft override (the SBP UI sometimes computes its
   *  own — we ignore in favour of recomputing, but the field is here so the
   *  schema is round-trip-safe). */
  readonly sqft?: number;
  readonly notes?: string;
}

// Loose category → Estimating piece-type id map. New mappings get added as
// SBP adds categories; unknown categories fall through to freeform.
// TODO: wire to the real Sign Builder Pro category taxonomy.
const SBP_CATEGORY_TO_PIECE_TYPE: Record<string, string> = {
  'vinyl-cut': 'vinyl-cutting',
  'vinyl-graphic': 'apply-vinyl-graphics',
  'channel-letter': 'channel-letter-fabrication',
  'pan-sign': 'alum-pan-sign',
  'post-panel': 'post-and-panel',
  'pole-cover': 'pole-cover',
  'routed-panel': 'routed-panel-shapes',
  'flex-cabinet-sf': 'sf-flex-cabinet',
  'flex-cabinet-df': 'df-flex-cabinet',
  'acrylic-cabinet-sf': 'sf-acrylic-cabinet',
  'acrylic-cabinet-df': 'df-acrylic-cabinet',
  'routed-cabinet-sf': 'sf-routed-cabinet',
  'routed-cabinet-df': 'df-routed-cabinet',
};

let counter = 0;
function nextId(): string {
  counter += 1;
  return `sbp-${Date.now().toString(36)}-${counter}`;
}

/** Map an SBP spec to a pre-filled Piece ready to drop into the project's
 *  piece list. Returns null when the category has no Estimating equivalent. */
export function importFromSBP(spec: SBPSignSpec): Piece | null {
  const typeId = SBP_CATEGORY_TO_PIECE_TYPE[spec.category] ?? 'freeform-tm';
  const type = getPieceType(typeId);
  if (!type) return null;

  const inputs: Record<string, number | string> = {};
  if (spec.heightIn != null) inputs.H = spec.heightIn;
  if (spec.lengthIn != null) inputs.L = spec.lengthIn;
  if (spec.qty != null) inputs.qty = spec.qty;
  if (spec.faces != null) inputs.faces = spec.faces;
  if (spec.panels != null) inputs.panels = spec.panels;
  if (spec.notes) inputs.description = spec.notes;

  // Pre-fill a vinyl material line if the spec supplied one — the user can
  // edit/remove in the UI.
  const extraMaterials = spec.vinylItemNo
    ? [{
        itemNo: spec.vinylItemNo,
        units: spec.sqft ?? 0,
      }]
    : undefined;

  return {
    id: nextId(),
    typeId,
    label: spec.notes ?? type.label,
    inputs,
    extraMaterials,
  };
}
