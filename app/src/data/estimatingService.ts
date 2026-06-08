// Sign Builder Pro → Estimating handoff. Sends the saved spec to the
// Estimating app via URL parameter so it can pre-fill a `lum_estimate`
// with one or more `lum_estimatepiece` rows.
//
// Contract — see docs/estimating-integration.md. Estimating reads the
// `?payload=` URL param on mount, base64-decodes it, parses as JSON, and
// uses `pieces[]` to seed its piece list. The Estimating app's URL is
// resolved from `getEstimatingBaseUrl()` so it can be swapped at deploy
// time without a rebuild.

import type { EstimatingPieceDraft } from "../domain/estimateMapping";
import { mapSpecToEstimatePieces } from "../domain/estimateMapping";
import type { SignSpec } from "../domain/SignSpec";

/** v1 of the payload contract. Bump the version if the shape changes so
    Estimating can detect old / new payloads and degrade gracefully. */
export const ESTIMATING_PAYLOAD_VERSION = 1;

export type EstimatingHandoffPayload = {
  version: number;
  source: "sign-builder-pro";
  sentAt: string;       // ISO timestamp
  /** Sign Builder Pro spec ID, so Estimating can link the resulting
      `lum_estimate` back to the originating `lum_signspecification`. */
  specId?: string;
  /** Inheritance from the SBP launch contract — when SBP was itself
      launched with ?jobId= or ?opportunityId=, the Estimating app picks
      up the same context. */
  jobId?: string;
  opportunityId?: string;
  /** Customer + project metadata to seed the `lum_estimate` header. */
  customerName?: string;
  projectName?: string;
  /** Human label that becomes the Estimating piece's description. */
  signName?: string;
  /** Full SBP product code, for the proposal summary. */
  productCode?: string;
  /** Notes carried over from SBP's StepNotesStatus card. */
  notes?: string;
  /** The piece-type drafts. Estimating creates one row per element with
      this piece type pre-selected and the dimensions / hints filled in. */
  pieces: EstimatingPieceDraft[];
};

/** Where to send the user. Override at deploy time once the Estimating
    app is hosted. The query string is appended by `buildEstimatingUrl`. */
const DEFAULT_ESTIMATING_BASE = "https://estimating.lumineosigns.com/";

export function getEstimatingBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ESTIMATING_BASE;
  // Optional runtime override — drop a global on window when the
  // Estimating app's URL is known at deploy time. Lets Switchboard /
  // Power Apps Code apps swap the URL without a Vite rebuild.
  const w = window as unknown as { LUMINEO_ESTIMATING_URL?: string };
  return w.LUMINEO_ESTIMATING_URL ?? DEFAULT_ESTIMATING_BASE;
}

/** Pack a payload + base URL into the final navigation URL. Estimating
    is a HashRouter app, so the payload goes after the hash so its
    useLocation().search picks it up. */
export function buildEstimatingUrl(
  payload: EstimatingHandoffPayload,
  baseUrl: string = getEstimatingBaseUrl(),
): string {
  const json = JSON.stringify(payload);
  // base64url-safe so we don't have to URL-encode + signs.
  const encoded = b64urlEncode(json);
  const hasHash = baseUrl.includes("#");
  if (!hasHash) return `${baseUrl}#/import?payload=${encoded}`;
  // Already has a hash. Append to the existing path's search.
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

/** Build the handoff payload from a saved SignSpec + the optional launch
    context (jobId / opportunityId). Pure function — no DOM access. */
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

/** Fire-and-forget: opens the Estimating app in a new tab with the spec
    pre-loaded. Returns the URL that was opened so callers can copy it. */
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
  // `btoa` only handles Latin-1; wrap in encodeURIComponent → escape so
  // multibyte characters survive.
  const raw = btoa(unescape(encodeURIComponent(s)));
  return raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
