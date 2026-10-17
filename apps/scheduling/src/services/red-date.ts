// Red Date — a job's fixed drop-dead install date (crfdf_jobschedule.redDate).
// Pure rules (no I/O), used by the red-date automation (store/red-date.ts) and
// the boards' move guard (schedule-store.ts):
//  - no card of the job may run past its red date;
//  - a red date with no install card places one, ending ON the red date, on the
//    top crew member of the Lumineo location nearest the job's ship-to, within
//    the job's install region (Jobs list "Install Region").

import { format, setHours, setMinutes, startOfDay, subBusinessDays } from "date-fns";
import type { Employee, ScheduleLine } from "../engine/types";
import { LUMINEO_LOCATIONS, milesBetween, type LatLng, type LumineoLocation, type Region } from "./geo";
import { INSTALL_LOCATIONS } from "./install-meta";

/** The Priority option that means "this job has a red date". */
export const RED_PRIORITY = "RED DATE";

/** Hours in one install day on the board (8–4). */
export const INSTALL_DAY_HOURS = 8;

/** Does a card ending at `end` run past `red`? Ending any time on the red date is fine. */
export function pastRedDate(end: Date, red: Date): boolean {
  // A card ending exactly at midnight belongs to the day before.
  const last = new Date(end.getTime() - 1);
  return startOfDay(last).getTime() > startOfDay(red).getTime();
}

/** "Fri, Oct 24" — for the notice text. */
export const redDateLabel = (red: Date): string => format(red, "EEE, MMM d");

/** The first line (of `lines`) that would run past its job's red date, or null. */
export function firstPastRedDate(
  lines: readonly Pick<ScheduleLine, "jobNo" | "endDateTime" | "isCustom" | "shipmentLoadId">[],
  redDateOf: (jobNo: string) => Date | null | undefined,
): { jobNo: string; red: Date } | null {
  for (const l of lines) {
    if (l.isCustom || l.shipmentLoadId || !l.jobNo) continue;
    const red = redDateOf(l.jobNo);
    if (red && pastRedDate(l.endDateTime, red)) return { jobNo: l.jobNo, red };
  }
  return null;
}

/**
 * Which install region a red-date card goes to, from the Jobs list Install
 * Region: WK / NEK → that region; blank → whichever is nearest (null); a
 * sub-installer or house job has no crew of ours → "skip".
 */
export function redDateRegion(installRegion: string | null | undefined): Region | null | "skip" {
  const r = (installRegion ?? "").trim().toUpperCase();
  if (r === "WK" || r === "NEK") return r;
  if (!r) return null;
  return "skip";
}

/** Install location option value (crfdf_location) for a Lumineo location name. */
export function locationIdOf(name: string): string | null {
  const hit = Object.entries(INSTALL_LOCATIONS).find(([, n]) => n.toLowerCase() === name.toLowerCase());
  return hit ? hit[0] : null;
}

/**
 * The crew member a red-date card goes to: the top person (roster order) at
 * the crew base nearest the ship-to, in `region`; when that location has no
 * one, the next-nearest base in the region. No ship-to position → the
 * region's bases in their listed order. Assist (lent production) rows never.
 */
export function pickRedDateCrew(
  shipTo: LatLng | null,
  region: Region | null,
  employees: readonly Employee[],
): { employee: Employee; location: LumineoLocation } | null {
  const bases = LUMINEO_LOCATIONS.filter((l) => l.crewBase && (!region || l.region === region));
  const ordered = shipTo ? [...bases].sort((a, b) => milesBetween(shipTo, a) - milesBetween(shipTo, b)) : bases;
  for (const loc of ordered) {
    const id = locationIdOf(loc.name);
    if (id == null) continue;
    const crew = employees
      .filter((e) => e.departmentId === id && !e.isAssist)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name));
    if (crew[0]) return { employee: crew[0], location: loc };
  }
  return null;
}

/**
 * When a red-date install card of `hours` runs: it ENDS on the red date — one
 * day or less starts there at 8:00; longer work starts enough business days
 * earlier (8 h a day) to finish on it.
 */
export function redDateWindow(red: Date, hours: number, startHour = 8): { start: Date; end: Date; days: number } {
  const h = hours > 0 ? hours : INSTALL_DAY_HOURS;
  const days = Math.max(1, Math.ceil(h / INSTALL_DAY_HOURS));
  const firstDay = subBusinessDays(startOfDay(red), days - 1);
  const start = setMinutes(setHours(firstDay, startHour), 0);
  const lastDayHours = h - (days - 1) * INSTALL_DAY_HOURS;
  const end = new Date(setMinutes(setHours(startOfDay(red), startHour), 0).getTime() + lastDayHours * 3_600_000);
  return { start, end, days };
}
