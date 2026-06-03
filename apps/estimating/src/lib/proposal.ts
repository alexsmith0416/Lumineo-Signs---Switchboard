// Plain-language proposal summary. Used by the Proposal view to give the
// estimator (or the customer) a short description of each piece without
// dumping engine internals.

import type { ComputedPieceResult } from './engine';
import { round2 } from './engine';

export interface PieceProposalLine {
  readonly piece: ComputedPieceResult;
  readonly description: string;
  readonly subtotal: number;
}

function dimensionsLine(inputs: Record<string, number | string>): string | null {
  const H = Number(inputs.H);
  const L = Number(inputs.L);
  if (Number.isFinite(H) && Number.isFinite(L) && H > 0 && L > 0) {
    return `${H}" × ${L}"`;
  }
  return null;
}

export function describePiece(p: ComputedPieceResult): string {
  const inputs = p.piece.inputs;
  const dims = dimensionsLine(inputs);
  const qty = Number(inputs.qty);
  const faces = Number(inputs.faces);
  const panels = Number(inputs.panels);

  const parts: string[] = [p.type.label];
  if (dims) parts.push(dims);
  if (Number.isFinite(qty) && qty > 1) parts.push(`× ${qty}`);
  if (Number.isFinite(faces) && faces > 1) parts.push(`${faces}-face`);
  if (Number.isFinite(panels) && panels > 1) parts.push(`${panels} panels`);
  if (p.sqft > 0) parts.push(`(${round2(p.sqft)} sqft)`);
  if (p.piece.label) parts.push(`— ${p.piece.label}`);
  return parts.join(' ');
}

export function buildProposal(pieces: readonly ComputedPieceResult[]): readonly PieceProposalLine[] {
  return pieces.map(p => ({
    piece: p,
    description: describePiece(p),
    subtotal: p.total,
  }));
}
