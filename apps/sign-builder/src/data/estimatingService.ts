// Sign Builder Pro → Estimating handoff. Sends the saved spec to the
// Estimating app (apps/estimating in the same repo, branch
// `claude/estimating-app`) so it can pre-fill one or more `Piece` rows.
//
// Payload shape v2 — aligned with the actual Piece / PieceInputs types
// from apps/estimating/src/lib/engine.ts and the piece-type registry in
// apps/estimating/src/data/pieceTypes.ts.

import type { EstimatingPieceDraft } from "../domain/estimateMapping";
import { mapSpecToEstimatePieces } from "../domain/estimateMapping";
import type { SignSpec } from "../domain/SignSpec";

/** Bumped from 1 → 2 to reflect the shape change (kebab-case typeIds +
    piece-type-specific input keys). */
export const ESTIMATING_PAYLOAD_VERSION = 2;

export type EstimatingHandoffPayload = {
  version: 2;
  source: "sign-builder-pro";
  sentAt: string;
  /** Sign Builder Pro spec id, so Estimating can link the resulting
      `lum_estimate` back to the originating `lum_signspecification`. */
  specId?: string;
  /** Cross-sub-app linkage inherited from the SBP launch contract. */
  jobId?: string;
  opportunityId?: string;
  /** Header metadata for seeding the `Project` (`lum_estimate`). */
  customerName?: string;
  projectName?: string;
  signName?: string;
  productCode?: string;
  notes?: string;
  /** Pieces draft — drop straight into Estimating's pieces list. */
  pieces: EstimatingPieceDraft[];
};

/** Estimating app URL. Override at deploy time via:
      window.LUMINEO_ESTIMATING_URL = "https://..." */
const DEFAULT_ESTIMATING_BASE = "https://estimating.lumineosigns.com/";

/** Resolve the Estimating app's base URL. Precedence:
 *   1. `window.LUMINEO_ESTIMATING_URL` — runtime override (set in index.html
 *      or by the Power Apps host) so you can repoint without a rebuild.
 *   2. `import.meta.env.VITE_ESTIMATING_URL` — build-time env (set in the
 *      Vercel/Netlify project) so each deploy targets its sibling.
 *   3. the production default.
 * See docs/deploy.md → "Connecting the two apps". */
export function getEstimatingBaseUrl(): string {
  const w = (typeof window !== "undefined" ? window : undefined) as
    | { LUMINEO_ESTIMATING_URL?: string }
    | undefined;
  const fromEnv =
    typeof import.meta !== "undefined" ? import.meta.env?.VITE_ESTIMATING_URL : undefined;
  return w?.LUMINEO_ESTIMATING_URL ?? fromEnv ?? DEFAULT_ESTIMATING_BASE;
}

/** Build the final navigation URL: base + #import?payload=<base64url>. */
export function buildEstimatingUrl(
  payload: EstimatingHandoffPayload,
  baseUrl: string = getEstimatingBaseUrl(),
): string {
  const encoded = b64urlEncode(JSON.stringify(payload));
  if (!baseUrl.includes("#")) return `${baseUrl}#import?payload=${encoded}`;
  // Preserve any existing hash path / query string.
  const hashIdx = baseUrl.indexOf("#");
  const pre = baseUrl.slice(0, hashIdx);
  const hash = baseUrl.slice(hashIdx + 1);
  const qIdx = hash.indexOf("?");
  const hashPath = qIdx === -1 ? hash : hash.slice(0, qIdx);
  const hashSearch = qIdx === -1 ? "" : hash.slice(qIdx + 1);
  const merged = new URLSearchParams(hashSearch);
  merged.set("payload", encoded);
  return `${pre}#${hashPath}?${merged.toString()}`;
}

export function buildEstimatingPayload(
  spec: SignSpec,
  ctx: { jobId?: string; opportunityId?: string } = {},
): EstimatingHandoffPayload {
  return {
    version: ESTIMATING_PAYLOAD_VERSION,
    source: "sign-builder-pro",
    sentAt: new Date().toISOString(),
    specId: spec.id,
    jobId: ctx.jobId || spec.jobId,
    opportunityId: ctx.opportunityId || spec.opportunityId,
    customerName: spec.customerName || undefined,
    projectName: spec.projectName || undefined,
    signName: spec.name || undefined,
    productCode: spec.productCode || undefined,
    notes: spec.notes || undefined,
    pieces: mapSpecToEstimatePieces(spec),
  };
}

export function sendSpecToEstimating(
  spec: SignSpec,
  ctx: { jobId?: string; opportunityId?: string } = {},
): string {
  const payload = buildEstimatingPayload(spec, ctx);
  const url = buildEstimatingUrl(payload);
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return url;
}

// ─── base64url helpers (no padding, +→-, /→_) ─────────────────────────────

function b64urlEncode(s: string): string {
  const raw = btoa(unescape(encodeURIComponent(s)));
  return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
