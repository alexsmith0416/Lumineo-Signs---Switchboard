// Work radius (Oct 17, 2026) — each install location's normal work radius
// (miles, set with "Add work radius…" on its banner, Admin / Ops). A card whose
// job is farther than its crew's home radius is "out of radius": it shows in
// the colours of the Lumineo location nearest the job (a Topeka crew on an
// Olathe job → Olathe's colours), as an outline or the whole card. A card can
// be set by hand to another location, or to "not out of radius". Pure.

import type { Employee, ScheduleLine } from "../engine/types";
import { LUMINEO_LOCATIONS, milesBetween, type LatLng } from "./geo";
import { INSTALL_LOCATIONS } from "./install-meta";
import { locationIdOf } from "./red-date";

export type RadiusMode = "outline" | "fill";

export interface WorkRadiusConfig {
  /** Location id (crfdf_location) → miles. */
  radius: Record<string, number>;
  mode: RadiusMode;
  /** Card id → location id to show, or "none" (never out of radius). */
  overrides: Record<string, string>;
}

export const EMPTY_WORK_RADIUS: WorkRadiusConfig = { radius: {}, mode: "outline", overrides: {} };

export interface RadiusFlag {
  /** The location whose colours the card shows. */
  locationId: string;
  locationName: string;
  /** Crew's home location. */
  homeName: string;
  /** Miles from home (null when set by hand). */
  miles: number | null;
  radius: number | null;
  manual: boolean;
}

const homeOf = (employee: Employee | undefined) => {
  if (!employee) return null;
  const name = INSTALL_LOCATIONS[Number(employee.departmentId)];
  const loc = name ? LUMINEO_LOCATIONS.find((l) => l.name === name) : undefined;
  return loc ? { id: employee.departmentId, loc } : null;
};

/** Out-of-radius flags for a board's cards. */
export function radiusFlags(input: {
  lines: readonly ScheduleLine[];
  employees: ReadonlyMap<string, Employee>;
  config: WorkRadiusConfig;
  positionOf: (line: ScheduleLine) => LatLng | null;
}): Map<string, RadiusFlag> {
  const out = new Map<string, RadiusFlag>();
  for (const l of input.lines) {
    if (l.isCustom || l.shipmentLoadId || l.mirrorOf || !l.jobNo) continue;
    const override = input.config.overrides[l.id];
    if (override === "none") continue;
    const home = homeOf(input.employees.get(l.employeeId));
    if (override) {
      out.set(l.id, {
        locationId: override,
        locationName: INSTALL_LOCATIONS[Number(override)] ?? "Location",
        homeName: home?.loc.name ?? "",
        miles: null,
        radius: null,
        manual: true,
      });
      continue;
    }
    if (!home) continue;
    const radius = input.config.radius[home.id];
    if (!radius || radius <= 0) continue;
    const pos = input.positionOf(l);
    if (!pos) continue;
    const miles = milesBetween(pos, home.loc);
    if (miles <= radius) continue;
    // The location the job is at: the nearest other crew base.
    const others = LUMINEO_LOCATIONS.filter((x) => x.crewBase && x.name !== home.loc.name);
    let best = others[0];
    for (const x of others) if (best && milesBetween(pos, x) < milesBetween(pos, best)) best = x;
    const id = best ? locationIdOf(best.name) : null;
    if (!best || id == null) continue;
    out.set(l.id, {
      locationId: id,
      locationName: best.name,
      homeName: home.loc.name,
      miles: Math.round(miles),
      radius,
      manual: false,
    });
  }
  return out;
}

/** The stored config → WorkRadiusConfig (anything malformed is dropped). */
export function parseWorkRadius(raw: unknown): WorkRadiusConfig {
  if (!raw || typeof raw !== "object") return { radius: {}, mode: "outline", overrides: {} };
  const o = raw as Record<string, unknown>;
  const radius: Record<string, number> = {};
  if (o.radius && typeof o.radius === "object") {
    for (const [k, v] of Object.entries(o.radius as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) radius[k] = n;
    }
  }
  const overrides: Record<string, string> = {};
  if (o.overrides && typeof o.overrides === "object") {
    for (const [k, v] of Object.entries(o.overrides as Record<string, unknown>)) if (typeof v === "string" && v) overrides[k] = v;
  }
  return { radius, mode: o.mode === "fill" ? "fill" : "outline", overrides };
}

/** Hover text for a flagged card. */
export function radiusFlagTitle(f: RadiusFlag): string {
  if (f.manual) return `Out of radius — shown as ${f.locationName} (set by hand)`;
  return `Outside ${f.homeName}'s ${f.radius}-mile work radius (${f.miles} mi) — ${f.locationName} area job`;
}
