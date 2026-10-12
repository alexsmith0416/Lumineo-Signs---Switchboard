/**
 * Address → map position for the Install Planner. Oct 11, 2026.
 *
 * openrouteservice's structured geocoder (free key; 1,000 lookups a day,
 * 100 a minute). openrouteservice is HeiGIT's; since Aug 2026 it's served from
 * api.heigit.org (geocoding = /pelias/v1, routing = /openrouteservice/v2) —
 * api.openrouteservice.org was switched off. The key goes in the Authorization
 * header (not the URL). Each job is looked up ONCE and kept in Dataverse
 * (crfdf_jobgeo); it's looked up again only when its ship-to address changes.
 * A result is trusted only when it lands near the job's ZIP; otherwise — or
 * with no key / no network — the pin goes at the ZIP's center, marked
 * approximate.
 *
 * The key lives in the app settings (crfdf_jobsviews "orsApiKey"), set in
 * Settings → Install Planner; the app's content security policy must allow
 * https://api.heigit.org (connect-src).
 */
import { milesBetween, type LatLng } from "./geo";
import type { ShipTo } from "./ship-to";

export const ORS_ORIGIN = "https://api.heigit.org";
/** Geocoding (Pelias) and routing (openrouteservice) on HeiGIT's API. */
export const ORS_GEOCODE = `${ORS_ORIGIN}/pelias/v1`;
export const ORS_ROUTING = `${ORS_ORIGIN}/openrouteservice/v2`;

/** Request headers carrying the key. */
export const orsHeaders = (key: string, json = false): Record<string, string> => ({
  Authorization: key,
  Accept: "application/json, application/geo+json",
  ...(json ? { "Content-Type": "application/json" } : {}),
});

/** How a position was found. */
export type GeoQuality = "address" | "zip" | "none";

export interface JobGeo extends Partial<LatLng> {
  jobNo: string;
  /** The address it was looked up from (normalized) — a changed address is looked up again. */
  address: string;
  quality: GeoQuality;
}

/** One line for comparing addresses: lower-case, single spaces. */
export function addressKey(a: Partial<ShipTo>): string {
  return [a.address, a.city, a.state, (a.zip ?? "").slice(0, 5)]
    .map((p) => (p ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

/** The structured-search URL for an address (the key goes in the headers — orsHeaders). */
export function orsGeocodeUrl(a: Partial<ShipTo>): string {
  const q = new URLSearchParams({ country: "USA", size: "1" });
  if (a.address?.trim()) q.set("address", a.address.trim());
  if (a.city?.trim()) q.set("locality", a.city.trim());
  if (a.state?.trim()) q.set("region", a.state.trim());
  if (a.zip?.trim()) q.set("postalcode", a.zip.trim().slice(0, 5));
  return `${ORS_GEOCODE}/search/structured?${q.toString()}`;
}

/** Farther than this from the job's ZIP center = a wrong match (another town with the same street). */
export const MAX_MILES_FROM_ZIP = 40;

/**
 * Read openrouteservice's answer. Trust it only when it's an actual place
 * (not just the country / state) and lands near the ZIP when we know it.
 */
export function parseOrsGeocode(body: unknown, zipCenter: LatLng | null): LatLng | null {
  const f = (body as { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: { layer?: string } }> })
    ?.features?.[0];
  const c = f?.geometry?.coordinates;
  if (!c || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return null;
  if (["country", "region", "macroregion", "county", "macrocounty"].includes(f?.properties?.layer ?? "")) return null;
  const p = { lat: c[1]!, lng: c[0]! };
  if (zipCenter && milesBetween(p, zipCenter) > MAX_MILES_FROM_ZIP) return null;
  return p;
}
