/**
 * Install Planner — Stage 3: auto-plan a week (pure). Oct 11, 2026.
 *
 * Rules (Alex, Oct 11): jobs locked on the board stay where they are (their
 * crew-days are taken); FIRM jobs are planned first — "Must this week" and
 * "Planned this week" (its Scheduled install is in the week, e.g. from Monthly
 * Gameplanning: the customer expects us), plus past-due jobs when that option
 * is on — then ready jobs fill what's left, DOLLARS FIRST by default (or most
 * jobs for the driving, as an option); the planner builds TRIPS from each crew location and
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
import { isFirm, radiusGroups, type PlannerJob } from "./install-planner";
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
  /** What fills the free time first: billing $ (default) or the most jobs for the driving. */
  priority?: "dollars" | "jobs";
  /** Past-due jobs (needed-by date passed) count as firm, like Must. */
  pastDueFirm?: boolean;
  /** On-site hours when BC has none. */
  unknownHours?: number;
}

export interface PlannedTrip {
  id: string;
  home: LumineoLocation;
  stops: TripStop[];
  plan: TripPlan;
  /** Firm jobs on it (Must / Planned this week / past due when firm). */
  mustCount: number;
  /** Billing value of its jobs. */
  value: number;
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
  /** Firm jobs planned / all firm jobs (Must + Planned this week). */
  mustJobs: number;
  mustTotal: number;
  /** Billing value of the jobs planned. */
  value: number;
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
  const firm = firmTest(input);
  // Firm first, then past due, then (dollars) the biggest jobs / (jobs) the nearest.
  const queue = [...jobs].sort(
    (a, b) =>
      Number(firm(b)) - Number(firm(a)) ||
      Number(b.daysLate > 0) - Number(a.daysLate > 0) ||
      (input.priority === "jobs" ? 0 : b.value - a.value) ||
      milesBetween(home, a.pos!) - milesBetween(home, b.pos!),
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

/** Is this job firm for this run (Must / Planned this week; past due when that option is on)? */
const firmTest = (input: Pick<WeekPlanInput, "pastDueFirm">) => (j: PlannerJob) => isFirm(j) || (!!input.pastDueFirm && j.daysLate > 0);

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
  const firm = firmTest(input);
  let n = 0;

  for (const region of regions) {
    // Only locations that have crews can be a trip's home.
    const bases = LUMINEO_LOCATIONS.filter(
      (l) => l.crewBase && (region === "all" || l.region === region) && input.crews.some((c) => c.base === l.name),
    );
    for (const kind of kinds) {
      const pool = input.jobs.filter(
        (j) => j.pos && (isFirm(j) || j.state === "ready") && (region === "all" || j.region === region) && (kind === "all" || j.kind === kind),
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
            trip: {
              id: `t${++n}`,
              home,
              stops: t.stops,
              plan: t.plan,
              mustCount: t.jobs.filter(firm).length,
              value: t.jobs.reduce((s, j) => s + j.value, 0),
            },
            jobs: t.jobs,
            region,
          });
        }
      }
    }
  }

  // Most firm jobs first, then past due, then (dollars) the most $ per crew-day
  // or (jobs) the most jobs per crew-day, then the least driving.
  const pastDue = (c: (typeof candidates)[number]) => c.jobs.filter((j) => j.daysLate > 0).length;
  const perDay = (c: (typeof candidates)[number]) =>
    (input.priority === "jobs" ? c.trip.stops.length : c.trip.value) / c.trip.plan.days.length;
  candidates.sort(
    (a, b) =>
      b.trip.mustCount - a.trip.mustCount ||
      pastDue(b) - pastDue(a) ||
      perDay(b) - perDay(a) ||
      a.trip.plan.driveHours - b.trip.plan.driveHours,
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

  // A firm job that didn't fit has to be dealt with — say so in its reason.
  for (const u of unplaced) if (firm(u.job)) u.reason = `Has to be on this week's schedule — ${u.reason.charAt(0).toLowerCase()}${u.reason.slice(1)}`;
  return { assignments, unplaced, stats: weekStats(assignments, unplaced, input.jobs) };
}

export function weekStats(assignments: readonly Assignment[], unplaced: readonly Unplaced[], jobs: readonly PlannerJob[]): WeekStats {
  const placed = new Set(assignments.flatMap((a) => a.trip.stops.map((s) => s.jobNo)));
  const must = jobs.filter(isFirm);
  return {
    jobs: placed.size,
    mustJobs: must.filter((j) => placed.has(j.jobNo)).length,
    mustTotal: must.length,
    value: assignments.reduce((t, a) => t + (a.trip.value ?? 0), 0),
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
