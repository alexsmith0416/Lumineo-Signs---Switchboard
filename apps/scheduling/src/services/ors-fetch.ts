/**
 * Calls to openrouteservice, with a clear reason when they fail (Oct 12, 2026).
 *
 * The browser gives the same bare "Failed to fetch" for two different
 * problems, and the planner used to blame the content security policy for
 * both:
 *  - "csp"        — the app's content security policy blocked the request
 *                   (the browser also fires a securitypolicyviolation event);
 *  - "unreadable" — openrouteservice answered, but its REFUSALS (403 for a
 *                   wrong / inactive key) carry no CORS header, so the browser
 *                   can't read them — almost always the key.
 * Plain HTTP errors (401 / 403 / 429 with a readable reply) come back as
 * responses, as usual.
 */
import { ORS_ORIGIN } from "./geocode";

export type OrsFailure = "csp" | "unreadable";

export class OrsError extends Error {
  constructor(
    readonly kind: OrsFailure,
    cause: unknown,
  ) {
    super(orsFailureText(kind));
    this.cause = cause;
  }
}

export function orsFailureText(kind: OrsFailure): string {
  return kind === "csp"
    ? "Blocked by the app's content security policy — add https://api.openrouteservice.org to connect-src (Power Platform admin center → the environment → Settings → Privacy + Security → App (code)), save, then reload the app."
    : "openrouteservice turned the request down — most often the key isn't right or isn't active yet. Check it in Settings → Install Planner and press Test.";
}

/** fetch() to openrouteservice; a failed request throws an OrsError saying why. */
export async function orsFetch(url: string, init?: RequestInit): Promise<Response> {
  let blocked = false;
  const onViolation = (e: SecurityPolicyViolationEvent) => {
    if (String(e.blockedURI ?? "").startsWith(ORS_ORIGIN)) blocked = true;
  };
  document.addEventListener("securitypolicyviolation", onViolation);
  try {
    return await fetch(url, init);
  } catch (e) {
    // The violation event can arrive just after the failed fetch.
    await new Promise((r) => setTimeout(r, 50));
    throw new OrsError(blocked ? "csp" : "unreadable", e);
  } finally {
    document.removeEventListener("securitypolicyviolation", onViolation);
  }
}

/** A readable reply's status → why (null = fine). */
export function orsStatusText(status: number): string | null {
  if (status === 401 || status === 403) return "openrouteservice refused the key — check it in Settings → Install Planner.";
  if (status === 429) return "openrouteservice's daily limit is used up — it resets tomorrow.";
  if (status >= 500) return `openrouteservice is having trouble (${status}) — try again later.`;
  return null;
}
