/**
 * Warehouse Management — where a delivery is received (pure). Oct 9, 2026.
 *
 * A delivery is received AT a site (one of Lumineo's locations) and put away in
 * a STORAGE spot there. Each login has a home site (Settings → Users,
 * crfdf_appuser.crfdf_homesite) that the Receive dialog defaults to.
 *
 * Storage spots are defined for Hutchinson only so far; at the other sites the
 * storage is typed in. To define a site's spots, add them to STORAGE_SPOTS.
 */
import { STORAGE_LOCATIONS } from "../components/jobs/jobs-editable";

/** The sites that receive deliveries (same names as the install boards' locations). */
export const RECEIVING_SITES: readonly string[] = ["Hutchinson", "Wichita", "Dodge City", "Olathe", "Topeka", "Lawrence"];

/** Each site's storage spots. A site that isn't here has none defined (free text). */
export const STORAGE_SPOTS: Readonly<Record<string, readonly string[]>> = {
  Hutchinson: STORAGE_LOCATIONS,
};

/** A site's storage spots ([] = none defined — type the location). */
export function storageSpotsFor(site: string): readonly string[] {
  const key = RECEIVING_SITES.find((s) => s.toLowerCase() === site.trim().toLowerCase());
  return (key && STORAGE_SPOTS[key]) || [];
}

/** A known site's canonical name, else "" (blank / unknown home site → no default). */
export function siteOrBlank(site: string | undefined): string {
  const t = (site ?? "").trim().toLowerCase();
  return RECEIVING_SITES.find((s) => s.toLowerCase() === t) ?? "";
}

/**
 * Where a delivery is: "Hutchinson · Warehouse - Floor", or just the site or
 * just the storage spot when only one is known ("" when neither). Deliveries
 * from before sites existed have only the storage spot.
 */
export function deliveryPlace(d: { site?: string; location: string }): string {
  return [d.site?.trim(), d.location.trim()].filter(Boolean).join(" · ");
}
