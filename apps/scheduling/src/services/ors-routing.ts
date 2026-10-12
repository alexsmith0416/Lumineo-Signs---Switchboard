/**
 * Road drive times and routes from openrouteservice (free key; the same one
 * the planner geocodes with). Oct 11, 2026.
 *
 *   matrix     — drive time + miles between every pair of points (one call)
 *   directions — the road route through points in order (for the map line)
 *
 * Free plan: 500 matrix + 2,000 directions calls a day — a trip uses one of
 * each. Any failure → the caller falls back to estimates (geo.ts).
 */
import { estimateMatrix, type Matrix } from "./trip-plan";
import { ORS_ORIGIN } from "./geocode";
import { orsFetch, orsStatusText } from "./ors-fetch";
import type { LatLng } from "./geo";

const lngLat = (p: LatLng) => [p.lng, p.lat];

/** The matrix request body. */
export const matrixBody = (points: readonly LatLng[]) => ({
  locations: points.map(lngLat),
  metrics: ["duration", "distance"],
  units: "mi",
});

/**
 * Read a matrix answer (seconds / miles). A pair with no road route (null)
 * takes the estimate for that pair, so one odd point can't break a trip.
 */
export function parseMatrix(body: unknown, points: readonly LatLng[]): Matrix | null {
  const b = body as { durations?: Array<Array<number | null>>; distances?: Array<Array<number | null>> };
  if (!b?.durations || b.durations.length !== points.length) return null;
  const est = estimateMatrix(points);
  return {
    hours: points.map((_, i) => points.map((__, j) => (i === j ? 0 : (b.durations![i]?.[j] ?? null) != null ? b.durations![i]![j]! / 3600 : est.hours[i]![j]!))),
    miles: points.map((_, i) => points.map((__, j) => (i === j ? 0 : (b.distances?.[i]?.[j] ?? null) != null ? b.distances![i]![j]! : est.miles[i]![j]!))),
    source: "road",
  };
}

/** The directions request body (points in driving order; at most 50). */
export const routeBody = (points: readonly LatLng[]) => ({ coordinates: points.slice(0, 50).map(lngLat), units: "mi" });

export interface RoadRoute {
  /** The road line, thinned to at most MAX_LINE_POINTS. */
  line: LatLng[];
  /** One leg per consecutive pair of points: hours + miles. */
  legs: Array<{ hours: number; miles: number }>;
}

export const MAX_LINE_POINTS = 600;

/** Read a directions (GeoJSON) answer. */
export function parseRoute(body: unknown): RoadRoute | null {
  const f = (body as {
    features?: Array<{ geometry?: { coordinates?: number[][] }; properties?: { segments?: Array<{ duration?: number; distance?: number }> } }>;
  })?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords?.length) return null;
  return {
    line: thin(coords.map((c) => ({ lat: c[1]!, lng: c[0]! })), MAX_LINE_POINTS),
    legs: (f?.properties?.segments ?? []).map((s) => ({ hours: (s.duration ?? 0) / 3600, miles: s.distance ?? 0 })),
  };
}

/** Keep every k-th point (always the first and last) so a long route stays small enough to save. */
export function thin<T>(pts: readonly T[], max: number): T[] {
  if (pts.length <= max) return [...pts];
  const step = (pts.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]!);
}

async function post(key: string, path: string, body: unknown): Promise<unknown> {
  const res = await orsFetch(`${ORS_ORIGIN}${path}`, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json, application/geo+json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(orsStatusText(res.status) ?? `openrouteservice ${res.status}`);
  return res.json();
}

/** Road matrix, or the estimate (with why) when openrouteservice can't be used. */
export async function roadMatrix(key: string, points: readonly LatLng[]): Promise<{ matrix: Matrix; note: string }> {
  if (!key) return { matrix: estimateMatrix(points), note: "No openrouteservice key — drive times are estimates." };
  try {
    const m = parseMatrix(await post(key, "/v2/matrix/driving-car", matrixBody(points)), points);
    if (m) return { matrix: m, note: "" };
    return { matrix: estimateMatrix(points), note: "openrouteservice returned no drive times — using estimates." };
  } catch (e) {
    return { matrix: estimateMatrix(points), note: `Using estimated drive times: ${e instanceof Error ? e.message : "openrouteservice couldn't be reached."}` };
  }
}

/** The road route through points in order, or null. */
export async function roadRoute(key: string, points: readonly LatLng[]): Promise<RoadRoute | null> {
  if (!key || points.length < 2) return null;
  try {
    return parseRoute(await post(key, "/v2/directions/driving-car/geojson", routeBody(points)));
  } catch {
    return null;
  }
}
