/**
 * Install Planner — Stage 3: auto-plan a week (pure). Oct 11, 2026.
 *
 * Rules (Alex, Oct 11): jobs locked on the board stay where they are (their
 * crew-days are taken); "Must this week" jobs are planned first, then ready
 * jobs fill what's left; the planner builds TRIPS from each crew location and
 * gives each to a crew AT that location (crews start from their own); a crew
 * day is 10 h including driving; over 4 h one-way = overnight (max nights,
 * adjustable) when overnights are allowed; install and service jobs share
 * trips only when combining is on; WK and NEK only mix when crossing is on.
 * Nothing is written here — the result is reviewed, then committed.
 *
 * Drive times are estimates (straight line × road factor) so a whole week can
 * be planned instantly; a trip opened in the Trip panel gets road times.
 */
import { LUMINEO_LOCATIONS, milesBetween, type LumineoLocation, type Region } from "./geo";
import { radiusGroups, type PlannerJob } from "./install-planner";
import { estimateMatrix, loopHours, needsOvernight, planDays, shortestLoop, type TripPlan } from "./trip-plan";
import type { TripStop } from "./saved-trips";

/** Mon–Fri. */
export const WEEK_DAYS = 5;

export interface PlanCrew {
  id: string;
  name: string;
  /** The Lumineo location the crew starts from ("Hutchinson"). */
  base: string;
  region: Region;
}

export interface WeekPlanInput {
  /** Must-this-week + ready jobs with a map position. */
  jobs: readonly PlannerJob[];
  crews: readonly PlanCrew[];
  /** Crew id → day indexes (0 = Monday) already taken on the board. */
  busy: ReadonlyMap<string, ReadonlySet<number>>;
  radiusMi: number;
  combineService: boolean;
  allowOvernight: boolean;
  maxNights: number;
  crossRegions: boolean;
  /** On-site hours when BC has none. */
  unknownHours?: number;
}

export interface PlannedTrip {
  id: string;
  home: LumineoLocation;
  stops: TripStop[];
  plan: TripPlan;
  mustCount: number;
}

export interface Assignment {
  trip: PlannedTrip;
  crewId: string;
  crewName: string;
  /** Day index of the trip's first day (0 = Monday). */
  startDay: number;
}

export interface Unplaced {
  job: PlannerJob;
  reason: string;
}

export interface WeekPlan {
  assignments: Assignment[];
  unplaced: Unplaced[];
  stats: WeekStats;
}

export interface WeekStats {
  jobs: number;
  mustJobs: number;
  mustTotal: number;
  crewHours: number;
  driveHours: number;
  miles: number;
  nights: number;
  crewDays: number;
  unplaced: number;
}

const UNKNOWN = 4;

const toStop = (j: PlannerJob, unknown: number): TripStop => ({
  jobNo: j.jobNo,
  name: j.name,
  address: j.address,
  zip: j.zip,
  kind: j.kind,
  hours: j.crewHours > 0 ? j.crewHours : unknown,
  lat: j.pos!.lat,
  lng: j.pos!.lng,
});

/** Plan a trip for these stops from this home; null when it breaks the rules. */
function tripFrom(
  home: LumineoLocation,
  stops: readonly TripStop[],
  input: Pick<WeekPlanInput, "allowOvernight" | "maxNights">,
): { plan: TripPlan; fits: boolean; why: string } {
  const m = estimateMatrix([home, ...stops]);
  const order = shortestLoop(m.hours);
  const overnight = input.allowOvernight && needsOvernight(m.hours, order);
  const plan = planDays({ matrix: m, order, work: [0, ...stops.map((s) => s.hours)], overnight, maxNights: input.maxNights });
  if (plan.days.length > WEEK_DAYS) return { plan, fits: false, why: `needs ${plan.days.length} days` };
  if (overnight && plan.nights > input.maxNights) return { plan, fits: false, why: `needs ${plan.nights} nights` };
  if (plan.warnings.some((w) => w.includes("drive alone"))) {
    return { plan, fits: false, why: input.allowOvernight ? "too far even with overnights" : "too far for a day trip — allow overnights" };
  }
  return { plan, fits: true, why: "" };
}

/**
 * Split a group into trips that fit: Must jobs first, then nearest the home
 * first; a job is added while the trip still fits, the rest start the next trip.
 */
function tripsForGroup(
  home: LumineoLocation,
  jobs: readonly PlannerJob[],
  input: WeekPlanInput,
): { trips: Array<{ stops: TripStop[]; plan: TripPlan; jobs: PlannerJob[] }>; dropped: Unplaced[] } {
  const unknown = input.unknownHours ?? UNKNOWN;
  const queue = [...jobs].sort(
    (a, b) => Number(b.state === "must") - Number(a.state === "must") || milesBetween(home, a.pos!) - milesBetween(home, b.pos!),
  );
  const trips: Array<{ stops: TripStop[]; plan: TripPlan; jobs: PlannerJob[] }> = [];
  const dropped: Unplaced[] = [];
  while (queue.length) {
    const taken: PlannerJob[] = [];
    let best: { plan: TripPlan } | null = null;
    for (let i = 0; i < queue.length; ) {
      const cand = [...taken, queue[i]!];
      const t = tripFrom(home, cand.map((j) => toStop(j, unknown)), input);
      if (t.fits) {
        taken.push(queue[i]!);
        best = t;
        queue.splice(i, 1);
      } else if (!taken.length) {
        // On its own it doesn't fit — it never will from here.
        dropped.push({ job: queue[i]!, reason: `From ${home.name}: ${t.why}.` });
        queue.splice(i, 1);
      } else i++;
    }
    if (taken.length && best) trips.push({ stops: taken.map((j) => toStop(j, unknown)), plan: best.plan, jobs: taken });
  }
  return { trips, dropped };
}

/** Day indexes free for a crew, after what's already planned / on the board. */
function freeRun(taken: ReadonlySet<number>, days: number): number {
  for (let start = 0; start + days <= WEEK_DAYS; start++) {
    let ok = true;
    for (let d = start; d < start + days; d++) if (taken.has(d)) ok = false;
    if (ok) return start;
  }
  return -1;
}

/**
 * Auto-plan the week. Returns the trips given to crews (with their start day)
 * and every job that didn't fit, with why.
 */
export function planWeek(input: WeekPlanInput): WeekPlan {
  const regions: Array<Region | "all"> = input.crossRegions ? ["all"] : ["WK", "NEK"];
  const kinds: Array<"install" | "service" | "all"> = input.combineService ? ["all"] : ["install", "service"];
  const taken = new Map<string, Set<number>>(input.crews.map((c) => [c.id, new Set(input.busy.get(c.id) ?? [])]));
  const unplaced: Unplaced[] = [];
  const candidates: Array<{ trip: PlannedTrip; jobs: PlannerJob[]; region: Region | "all" }> = [];
  let n = 0;

  for (const region of regions) {
    // Only locations that have crews can be a trip's home.
    const bases = LUMINEO_LOCATIONS.filter(
      (l) => l.crewBase && (region === "all" || l.region === region) && input.crews.some((c) => c.base === l.name),
    );
    for (const kind of kinds) {
      const pool = input.jobs.filter(
        (j) => j.pos && (j.state === "must" || j.state === "ready") && (region === "all" || j.region === region) && (kind === "all" || j.kind === kind),
      );
      if (!pool.length) continue;
      if (!bases.length) {
        for (const j of pool) unplaced.push({ job: j, reason: `No ${region === "all" ? "" : region + " "}crews on the install board.` });
        continue;
      }
      for (const g of radiusGroups(pool, input.radiusMi, input.crossRegions)) {
        // The location with the shortest loop through the group (that has crews).
        const home = bases
          .map((b) => {
            const m = estimateMatrix([b, ...g.jobs.map((j) => j.pos!)]);
            return { b, loop: loopHours(m.hours, shortestLoop(m.hours)) };
          })
          .sort((a, b) => a.loop - b.loop)[0]!.b;
        const { trips, dropped } = tripsForGroup(home, g.jobs, input);
        unplaced.push(...dropped);
        for (const t of trips) {
          candidates.push({
            trip: { id: `t${++n}`, home, stops: t.stops, plan: t.plan, mustCount: t.jobs.filter((j) => j.state === "must").length },
            jobs: t.jobs,
            region,
          });
        }
      }
    }
  }

  // Most Must jobs first, then the most jobs per crew-day.
  candidates.sort(
    (a, b) =>
      b.trip.mustCount - a.trip.mustCount ||
      b.trip.stops.length / b.trip.plan.days.length - a.trip.stops.length / a.trip.plan.days.length,
  );

  const assignments: Assignment[] = [];
  for (const c of candidates) {
    const days = c.trip.plan.days.length;
    // The crew at that location that can start it soonest (ties: the least
    // busy), so work spreads over the crews and gets done early in the week.
    const place = (trip: PlannedTrip): Assignment | null => {
      let best: { a: Assignment; load: number } | null = null;
      for (const crew of input.crews.filter((x) => x.base === trip.home.name)) {
        const start = freeRun(taken.get(crew.id)!, days);
        if (start < 0) continue;
        const load = taken.get(crew.id)!.size;
        if (!best || start < best.a.startDay || (start === best.a.startDay && load < best.load)) {
          best = { a: { trip, crewId: crew.id, crewName: crew.name, startDay: start }, load };
        }
      }
      return best?.a ?? null;
    };
    let a = place(c.trip);
    if (!a) {
      // Another location in the region with a free crew, if the trip still fits from there.
      const others = LUMINEO_LOCATIONS.filter(
        (l) => l.crewBase && l.name !== c.trip.home.name && (c.region === "all" || l.region === c.region) && input.crews.some((x) => x.base === l.name),
      );
      for (const home of others) {
        const t = tripFrom(home, c.trip.stops, input);
        if (!t.fits || t.plan.days.length !== days) continue;
        a = place({ ...c.trip, home, plan: t.plan });
        if (a) break;
      }
    }
    if (!a) {
      for (const j of c.jobs) unplaced.push({ job: j, reason: `No crew free for ${days} day${days === 1 ? "" : "s"} in a row this week.` });
      continue;
    }
    for (let d = a.startDay; d < a.startDay + days; d++) taken.get(a.crewId)!.add(d);
    assignments.push(a);
  }

  return { assignments, unplaced, stats: weekStats(assignments, unplaced, input.jobs) };
}

export function weekStats(assignments: readonly Assignment[], unplaced: readonly Unplaced[], jobs: readonly PlannerJob[]): WeekStats {
  const placed = new Set(assignments.flatMap((a) => a.trip.stops.map((s) => s.jobNo)));
  const must = jobs.filter((j) => j.state === "must");
  return {
    jobs: placed.size,
    mustJobs: must.filter((j) => placed.has(j.jobNo)).length,
    mustTotal: must.length,
    crewHours: assignments.reduce((t, a) => t + a.trip.plan.workHours, 0),
    driveHours: assignments.reduce((t, a) => t + a.trip.plan.driveHours, 0),
    miles: assignments.reduce((t, a) => t + a.trip.plan.miles, 0),
    nights: assignments.reduce((t, a) => t + a.trip.plan.nights, 0),
    crewDays: assignments.reduce((t, a) => t + a.trip.plan.days.length, 0),
    unplaced: unplaced.length,
  };
}

// ---------------------------------------------------------------------------
// Cards for the install board
// ---------------------------------------------------------------------------

export interface PlannedCard {
  jobNo: string;
  name: string;
  crewId: string;
  /** 0 = Monday. */
  day: number;
  /** Hours since midnight the work starts. */
  start: number;
  hours: number;
  kind: "install" | "service";
  zip: string;
  /** "part 1 of 2" when a job carries over. */
  part: number;
  parts: number;
}

/** One card per job per day it's worked, at the time the trip reaches it. */
export function cardsFor(a: Assignment, startHour: number): PlannedCard[] {
  const out: PlannedCard[] = [];
  a.trip.plan.days.forEach((d, i) => {
    let t = startHour;
    for (const e of d.events) {
      if (e.type === "work") {
        const s = a.trip.stops[e.stop - 1]!;
        out.push({
          jobNo: s.jobNo,
          name: s.name,
          crewId: a.crewId,
          day: a.startDay + i,
          start: t,
          hours: e.hours,
          kind: s.kind,
          zip: s.zip,
          part: e.part,
          parts: e.parts,
        });
      }
      t += e.hours;
    }
  });
  return out;
}
