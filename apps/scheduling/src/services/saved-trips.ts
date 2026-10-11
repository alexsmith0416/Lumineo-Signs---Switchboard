/**
 * Install Planner — a saved trip (Oct 11, 2026): everything the installers'
 * view-only Trips screen and the printed sheet need, frozen when Admin / Ops
 * saved it (stops, the day plan, the road line). Stored as JSON in Dataverse
 * crfdf_installtrip (scripts/create-installtrip-table.ps1). Pure helpers.
 */
import type { LatLng, Region } from "./geo";
import { googleMapsDirUrl, type TripPlan } from "./trip-plan";

export interface TripStop extends LatLng {
  jobNo: string;
  name: string;
  /** Street address line (for Google Maps / the sheet); "" when unknown. */
  address: string;
  zip: string;
  kind: "install" | "service";
  /** On-site crew hours used for this trip (BC hours, or tweaked here). */
  hours: number;
}

export interface TripHome extends LatLng {
  name: string;
  address: string;
}

export interface SavedTrip {
  id: string;
  name: string;
  region: Region;
  /** Monday of the week it's planned for, YYYY-MM-DD. */
  weekStart: string;
  home: TripHome;
  /** stops[i] is stop index i + 1 in `plan`. */
  stops: TripStop[];
  plan: TripPlan;
  /** Departure hour (7 = 7:00 AM). */
  startHour: number;
  maxNights: number;
  /** Where the drive times came from. */
  source: "road" | "estimate";
  /** The road route to draw (thinned); [] = straight lines between stops. */
  line: LatLng[];
  savedBy: string;
  /** ISO. */
  savedAt: string;
}

/** "7:00 AM" for hours since midnight. */
export function clock(h: number): string {
  const mins = Math.round(h * 60);
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

/** "1 h 25 m" / "45 m". */
export function duration(h: number): string {
  const mins = Math.round(h * 60);
  if (mins < 60) return `${mins} m`;
  return `${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} m` : ""}`;
}

/** What Google Maps should search for a point: its address when known, else its coordinates. */
const place = (p: { address?: string; zip?: string } & LatLng) =>
  p.address ? `${p.address}${p.zip && !p.address.includes(p.zip) ? ` ${p.zip}` : ""}` : `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

/** A Google Maps link for one day of a trip: where it starts → each stop → where it ends. */
export function dayMapsUrl(trip: Pick<SavedTrip, "home" | "stops" | "plan">, dayIndex: number): string {
  const day = trip.plan.days[dayIndex];
  if (!day) return "";
  const pt = (i: number) => (i === 0 ? place(trip.home) : place(trip.stops[i - 1]!));
  const seq: string[] = [];
  for (const e of day.events) {
    if (e.type !== "drive") continue;
    if (!seq.length) seq.push(pt(e.from));
    seq.push(pt(e.to));
  }
  return googleMapsDirUrl(seq);
}

/** The name a new trip gets: "WK · Hutchinson → Salina area · 3 jobs". */
export function defaultTripName(region: Region, home: string, stops: readonly TripStop[]): string {
  const towns = [
    ...new Set(stops.map((s) => s.address.split(",").slice(-2, -1)[0]?.trim()).filter((t): t is string => !!t && t !== home)),
  ];
  const area = towns.length ? ` → ${towns.slice(0, 2).join(", ")}${towns.length > 2 ? "…" : ""}` : " (local)";
  return `${region} · ${home}${area} · ${stops.length} job${stops.length === 1 ? "" : "s"}`;
}
