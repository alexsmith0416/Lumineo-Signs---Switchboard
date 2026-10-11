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
}

/**
 * Where crews start. APPROXIMATE — each town's ZIP center until the shops'
 * street addresses are entered (then geocoded like any job).
 */
export const LUMINEO_LOCATIONS: readonly LumineoLocation[] = [
  { name: "Hutchinson", region: "WK", lat: 37.9782, lng: -97.9265 },
  { name: "Wichita", region: "WK", lat: 37.687, lng: -97.3349 },
  { name: "Dodge City", region: "WK", lat: 37.7301, lng: -100.0601 },
  { name: "Olathe", region: "NEK", lat: 38.8938, lng: -94.88 },
  { name: "Topeka", region: "NEK", lat: 39.0575, lng: -95.6747 },
  { name: "Lawrence", region: "NEK", lat: 39.0329, lng: -95.2091 },
];

/** The nearest Lumineo location (optionally only one region's). */
export function nearestLocation(p: LatLng, region?: Region): LumineoLocation {
  const pool = region ? LUMINEO_LOCATIONS.filter((l) => l.region === region) : LUMINEO_LOCATIONS;
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
