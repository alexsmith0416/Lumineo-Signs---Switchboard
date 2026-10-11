/**
 * Geography for the Install Planner (pure). Oct 11, 2026.
 *
 * Distances are straight-line (great-circle) miles; DRIVE estimates multiply
 * them by a road factor and divide by an average speed — good enough to group
 * jobs and size trips before real road routes come in (Stage 2, openrouteservice).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Straight-line distance in miles. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Roads aren't straight: Kansas grid roads run ~1.25× the straight line. */
export const ROAD_FACTOR = 1.25;
/** Average door-to-door speed, mph (highway + town). */
export const AVG_MPH = 55;

/** Estimated road miles between two points. */
export const roadMiles = (a: LatLng, b: LatLng): number => milesBetween(a, b) * ROAD_FACTOR;
/** Estimated drive hours between two points. */
export const driveHours = (a: LatLng, b: LatLng): number => roadMiles(a, b) / AVG_MPH;

export type Region = "WK" | "NEK";

export interface LumineoLocation extends LatLng {
  name: string;
  region: Region;
  address: string;
  phone: string;
  /** Install crews leave from here (a trip's home). Salina: not confirmed yet. */
  crewBase: boolean;
}

/**
 * Lumineo's locations (Alex, Oct 11, 2026) — street addresses, placed by the
 * US Census geocoder (exact matches). Crews start at their own location.
 */
export const LUMINEO_LOCATIONS: readonly LumineoLocation[] = [
  { name: "Hutchinson", region: "WK", lat: 38.05716, lng: -97.95798, address: "1429 W 4th Ave, Hutchinson, KS 67501", phone: "(620) 662-2363", crewBase: true },
  { name: "Wichita", region: "WK", lat: 37.69039, lng: -97.31735, address: "327 N Hydraulic Ave #300, Wichita, KS 67214", phone: "(316) 202-2025", crewBase: true },
  { name: "Dodge City", region: "WK", lat: 37.75193, lng: -99.98492, address: "2300 E Wyatt Earp Blvd, Dodge City, KS 67801", phone: "(620) 227-2307", crewBase: true },
  { name: "Salina", region: "WK", lat: 38.78369, lng: -97.62997, address: "1500 W Schilling Rd, Salina, KS 67401", phone: "(785) 823-1789", crewBase: false },
  { name: "Olathe", region: "NEK", lat: 38.90603, lng: -94.78773, address: "1805 E 123rd St, Olathe, KS 66061", phone: "(913) 780-3330", crewBase: true },
  { name: "Topeka", region: "NEK", lat: 38.9952, lng: -95.69716, address: "1510 SW 41st St, Topeka, KS 66609", phone: "(785) 267-2625", crewBase: true },
  { name: "Lawrence", region: "NEK", lat: 38.94265, lng: -95.22554, address: "801 E 23rd St, Lawrence, KS 66046", phone: "(785) 842-4930", crewBase: true },
];

/** The nearest Lumineo location crews leave from (optionally only one region's). */
export function nearestLocation(p: LatLng, region?: Region): LumineoLocation {
  // Only where crews start from.
  const bases = LUMINEO_LOCATIONS.filter((l) => l.crewBase);
  const pool = region ? bases.filter((l) => l.region === region) : bases;
  let best = pool[0]!;
  let bestMi = Infinity;
  for (const l of pool) {
    const mi = milesBetween(p, l);
    if (mi < bestMi) {
      best = l;
      bestMi = mi;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// ZIP centers — the fallback when an address can't be geocoded.
// ---------------------------------------------------------------------------
let zipTable: Map<string, LatLng> | null = null;

/** Parse "zip,lat,lng" lines (data/zip-centroids.ts). Exported for tests. */
export function parseZipCentroids(csv: string): Map<string, LatLng> {
  const m = new Map<string, LatLng>();
  for (const line of csv.split("\n")) {
    const [z, lat, lng] = line.split(",");
    if (z && lat && lng) m.set(z, { lat: Number(lat), lng: Number(lng) });
  }
  return m;
}

/** Load the ZIP-center table (a separate chunk, fetched the first time it's needed). */
export async function loadZipCentroids(): Promise<Map<string, LatLng>> {
  if (!zipTable) zipTable = parseZipCentroids((await import("../data/zip-centroids")).ZIP_CENTROIDS_CSV);
  return zipTable;
}

/** A ZIP's center ("67501-1234" works), or null when it's not in the table. */
export function zipCenter(table: Map<string, LatLng>, zip: string): LatLng | null {
  const z = (zip ?? "").trim().slice(0, 5);
  return table.get(z) ?? null;
}
