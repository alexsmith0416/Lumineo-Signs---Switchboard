/**
 * Install Planner — Stage 2: a trip for a group of jobs (pure). Oct 11, 2026.
 *
 * Rules (Alex, Oct 11): the crew leaves from its own Lumineo location and
 * comes back; the route is the SHORTEST LOOP through the jobs; a crew day is
 * at most 10 h INCLUDING driving; a one-way drive over 4 h makes the trip an
 * overnight (up to 2 nights by default, adjustable); install hours are crew
 * hours on site (BC planning lines, tweakable per job here).
 *
 * Index 0 of every matrix is the home location; 1..n are the stops in the
 * order the caller listed them. Hours / miles come from openrouteservice road
 * routes when available, else estimates (geo.ts).
 */
import { driveHours, roadMiles, type LatLng } from "./geo";

export const TRIP_DAY_HOURS = 10;
export const OVERNIGHT_AFTER_HOURS = 4;

export interface Matrix {
  /** hours[i][j] = drive time i → j. */
  hours: number[][];
  /** miles[i][j] = road miles i → j. */
  miles: number[][];
  /** "road" = openrouteservice, "estimate" = straight line × road factor. */
  source: "road" | "estimate";
}

/** A straight-line estimate matrix for these points (index 0 = home). */
export function estimateMatrix(points: readonly LatLng[]): Matrix {
  return {
    hours: points.map((a) => points.map((b) => (a === b ? 0 : driveHours(a, b)))),
    miles: points.map((a) => points.map((b) => (a === b ? 0 : roadMiles(a, b)))),
    source: "estimate",
  };
}

/** Total drive hours of the loop home → order… → home. */
export function loopHours(hours: number[][], order: readonly number[]): number {
  let t = 0;
  let at = 0;
  for (const s of order) {
    t += hours[at]![s]!;
    at = s;
  }
  return t + (order.length ? hours[at]![0]! : 0);
}

/**
 * The shortest loop from home (0) through every stop (1..n) and back: exact
 * (Held-Karp) up to 11 stops, nearest-neighbour + 2-opt beyond.
 */
export function shortestLoop(hours: number[][]): number[] {
  const n = hours.length - 1;
  if (n <= 0) return [];
  if (n === 1) return [1];
  if (n <= 11) return heldKarp(hours, n);
  return twoOpt(hours, nearestNeighbour(hours, n));
}

function heldKarp(h: number[][], n: number): number[] {
  const FULL = 1 << n;
  const cost = new Float64Array(FULL * n).fill(Infinity);
  const prev = new Int16Array(FULL * n).fill(-1);
  for (let j = 0; j < n; j++) cost[(1 << j) * n + j] = h[0]![j + 1]!;
  for (let mask = 1; mask < FULL; mask++) {
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j))) continue;
      const c = cost[mask * n + j]!;
      if (c === Infinity) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const next = mask | (1 << k);
        const nc = c + h[j + 1]![k + 1]!;
        if (nc < cost[next * n + k]!) {
          cost[next * n + k] = nc;
          prev[next * n + k] = j;
        }
      }
    }
  }
  let best = Infinity;
  let last = 0;
  for (let j = 0; j < n; j++) {
    const c = cost[(FULL - 1) * n + j]! + h[j + 1]![0]!;
    if (c < best) {
      best = c;
      last = j;
    }
  }
  const order: number[] = [];
  let mask = FULL - 1;
  let j = last;
  while (j >= 0) {
    order.push(j + 1);
    const p = prev[mask * n + j]!;
    mask &= ~(1 << j);
    j = p;
  }
  return order.reverse();
}

function nearestNeighbour(h: number[][], n: number): number[] {
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order: number[] = [];
  let at = 0;
  while (left.size) {
    let best = -1;
    for (const s of left) if (best < 0 || h[at]![s]! < h[at]![best]!) best = s;
    order.push(best);
    left.delete(best);
    at = best;
  }
  return order;
}

function twoOpt(h: number[][], order: number[]): number[] {
  let best = [...order];
  let bestCost = loopHours(h, best);
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const cand = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        const c = loopHours(h, cand);
        if (c + 1e-9 < bestCost) {
          best = cand;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export type TripEvent =
  | { type: "drive"; from: number; to: number; hours: number; miles: number }
  | { type: "work"; stop: number; hours: number; part: number; parts: number };

export interface TripDay {
  day: number;
  events: TripEvent[];
  driveHours: number;
  workHours: number;
  /** "home" = back at the location; else the stop index the crew stays near. */
  endsAt: "home" | number;
}

export interface TripPlan {
  /** Stop indices (1..n) in driving order. */
  order: number[];
  days: TripDay[];
  overnight: boolean;
  nights: number;
  driveHours: number;
  miles: number;
  workHours: number;
  warnings: string[];
}

/** Below this, a day's leftover time isn't worth starting a job in. */
const MIN_WORK_SLICE = 0.5;

/**
 * Lay a trip out day by day. Day trip: every day starts and ends at home, so
 * the drive back is held back from each day. Overnight: the crew stays near
 * where it stopped and carries on next morning; only the last day drives home.
 * A job that doesn't fit in what's left of a day continues the next day.
 */
export function planDays(input: {
  matrix: Matrix;
  order: readonly number[];
  /** On-site crew hours per stop index (index 0 unused). */
  work: readonly number[];
  overnight: boolean;
  maxNights: number;
  dayHours?: number;
}): TripPlan {
  const { matrix, order, work, overnight, maxNights } = input;
  const DAY = input.dayHours ?? TRIP_DAY_HOURS;
  const H = matrix.hours;
  const M = matrix.miles;
  const days: TripDay[] = [];
  const warnings: string[] = [];
  let day: TripDay = { day: 1, events: [], driveHours: 0, workHours: 0, endsAt: "home" };
  let clock = 0;
  let at = 0;

  const drive = (to: number) => {
    if (to === at) return;
    day.events.push({ type: "drive", from: at, to, hours: H[at]![to]!, miles: M[at]![to]! });
    day.driveHours += H[at]![to]!;
    clock += H[at]![to]!;
    at = to;
  };
  const endDay = () => {
    if (overnight) day.endsAt = at === 0 ? "home" : at;
    else {
      drive(0);
      day.endsAt = "home";
    }
    days.push(day);
    day = { day: days.length + 1, events: [], driveHours: 0, workHours: 0, endsAt: "home" };
    clock = 0;
    if (!overnight) at = 0;
  };

  for (const s of order) {
    let left = Math.max(0, work[s] ?? 0);
    const parts: number[] = [];
    if (left === 0) {
      drive(s);
      continue;
    }
    while (left > 1e-9) {
      const reserve = overnight ? 0 : H[s]![0]!;
      let room = DAY - clock - (at === s ? 0 : H[at]![s]!) - reserve;
      if (room < Math.min(MIN_WORK_SLICE, left) && clock > 0) {
        endDay();
        continue;
      }
      if (room <= 0) {
        // Even a fresh day can't fit the drive there and back.
        warnings.push(`Stop ${s}: the drive alone fills a ${DAY} h day — plan it as an overnight.`);
        room = left;
      }
      drive(s);
      const chunk = Math.min(left, room);
      parts.push(chunk);
      day.events.push({ type: "work", stop: s, hours: chunk, part: parts.length, parts: 0 });
      day.workHours += chunk;
      clock += chunk;
      left -= chunk;
      if (left > 1e-9) endDay();
    }
    // Now that the job's split is known, say "part 1 of 2" on each piece.
    for (const d of [...days, day]) for (const e of d.events) if (e.type === "work" && e.stop === s) e.parts = parts.length;
  }
  // Home.
  if (overnight && at !== 0 && clock > 0 && clock + H[at]![0]! > DAY) endDay();
  drive(0);
  day.endsAt = "home";
  if (day.events.length) days.push(day);

  const nights = days.filter((d) => d.endsAt !== "home").length;
  if (overnight && nights > maxNights) {
    warnings.push(
      `Needs ${nights} night${nights === 1 ? "" : "s"} away — over the ${maxNights}-night limit. Take some jobs off or use a smaller radius.`,
    );
  }
  for (const d of days) {
    const total = d.driveHours + d.workHours;
    if (total > DAY + 0.01) warnings.push(`Day ${d.day} runs ${total.toFixed(1)} h — over ${DAY} h.`);
  }
  const all = days.flatMap((d) => d.events);
  return {
    order: [...order],
    days,
    overnight,
    nights,
    driveHours: days.reduce((t, d) => t + d.driveHours, 0),
    miles: all.reduce((t, e) => t + (e.type === "drive" ? e.miles : 0), 0),
    workHours: days.reduce((t, d) => t + d.workHours, 0),
    warnings,
  };
}

/** Over 4 h one-way to any stop → overnight. */
export const needsOvernight = (hours: number[][], stops: readonly number[]): boolean =>
  stops.some((s) => hours[0]![s]! > OVERNIGHT_AFTER_HOURS);

/**
 * A Google Maps directions link for one day (free; opens the app on phones).
 * Stops are addresses when known, else "lat,lng". Google takes up to 9
 * waypoints in a link — a longer day is cut there (the sheet lists the rest).
 */
export function googleMapsDirUrl(points: readonly string[]): string {
  if (points.length < 2) return "";
  const origin = points[0]!;
  const destination = points[points.length - 1]!;
  const waypoints = points.slice(1, -1).slice(0, 9);
  const q = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (waypoints.length) q.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}
