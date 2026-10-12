/**
 * Install Planner — Stage 1: radius groups and "what fits near this job" (pure).
 * Oct 11, 2026.
 *
 * Rules (Alex, Oct 11):
 *  - a crew day is at most 10 h, DRIVE INCLUDED;
 *  - a one-way drive over 4 h from the home location makes it an overnight trip
 *    (up to 2 nights, adjustable);
 *  - crews always start from their own Lumineo location;
 *  - WK and NEK are planned separately unless crossing is allowed;
 *  - install labor = the BC install planning-line hours, CREW hours (on site).
 *
 * Grouping: a group is every ready job within R miles of the group's CENTER (a
 * job), not jobs whose circles merely touch — touching circles chain (A–B–C)
 * and can stretch a "group" across the state. Centers are picked greedily:
 * the job with the most Must-this-week jobs around it, then the most jobs,
 * then the most hours. Drive figures are estimates (geo.ts) until Stage 2's
 * road routes.
 */
import { driveHours, milesBetween, nearestLocation, type LatLng, type LumineoLocation, type Region } from "./geo";
import { COMPLETE_STATUSES } from "./job-status";
import { INSTALL_STEP } from "./production-steps";
import type { PlanStep } from "./gameplan";

export const DAY_HOURS = 10;
export const OVERNIGHT_ONE_WAY_HOURS = 4;

/**
 * Where a job stands this week, for the pin color and the planner.
 * "must" (the region's Must this week list) and "planned" (its Scheduled
 * install falls in the week — Monthly Gameplanning's commit, or set by hand;
 * the customer expects us) are FIRM: they have to be on that week's schedule.
 */
export type PlanState = "must" | "planned" | "locked" | "scheduled" | "ready";

/** Must this week or Planned this week — has to be on the schedule that week. */
export const isFirm = (j: Pick<PlannerJob, "state">): boolean => j.state === "must" || j.state === "planned";

export interface PlannerJob {
  jobNo: string;
  name: string;
  kind: "install" | "service";
  region: Region;
  state: MapState;
  /** Map position; null = couldn't be placed (no address / ZIP). */
  pos: LatLng | null;
  /** True when pos is only the ZIP's center. */
  approx: boolean;
  address: string;
  zip: string;
  /** On-site crew hours (BC install planning lines); 0 = unknown. */
  crewHours: number;
  /** YYYY-MM-DD of the job's install card(s) on the board, "" when none. */
  scheduledDate: string;
  /** Billing value: BC remaining balance, else the sales order amount; 0 = unknown. */
  value: number;
  /** YYYY-MM-DD it's needed by (RED date, else Scheduled install, else Install target — as Monthly). */
  neededBy: string;
  /** Days past neededBy as of today (0 = not late). */
  daysLate: number;
}

export interface JobGroup {
  id: string;
  center: LatLng;
  /** Nearest first from the center. */
  jobs: PlannerJob[];
  crewHours: number;
  /** Firm jobs in it (Must + Planned this week). */
  mustCount: number;
  /** Billing value of its jobs. */
  value: number;
  /** The crew's start: the nearest Lumineo location (in the group's region unless crossing). */
  home: LumineoLocation;
  /** Estimated one-way drive, home → farthest job, hours. */
  oneWayHours: number;
  overnight: boolean;
  /** Rough crew-days for the trip (Stage 2 plans the real days). */
  estDays: number;
}

/** Jobs the planner may group: ready + firm (Must / Planned this week), placed on the map. */
export const plannable = (j: PlannerJob): boolean => !!j.pos && (j.state === "ready" || isFirm(j));

/**
 * Rough crew-days for a trip with this much on-site work and this one-way drive.
 * Day trip: each day loses the drive out and back. Overnight: only the first
 * and last day drive; every day is DAY_HOURS.
 */
export function estimateDays(crewHours: number, oneWayHours: number, overnight: boolean): number {
  if (crewHours <= 0) return 1;
  if (overnight) return Math.max(1, Math.ceil((crewHours + 2 * oneWayHours) / DAY_HOURS));
  const perDay = Math.max(1, DAY_HOURS - 2 * oneWayHours);
  return Math.max(1, Math.ceil(crewHours / perDay));
}

/**
 * Group the plannable jobs: every job within `radiusMi` of a center job.
 * `crossRegions` = WK and NEK jobs may share a group (and a home location).
 */
export function radiusGroups(jobs: readonly PlannerJob[], radiusMi: number, crossRegions = false): JobGroup[] {
  const pool = jobs.filter(plannable);
  const left = new Set(pool.map((j) => j.jobNo));
  const byNo = new Map(pool.map((j) => [j.jobNo, j]));
  const groups: JobGroup[] = [];

  const near = (c: PlannerJob) =>
    pool.filter(
      (j) => left.has(j.jobNo) && (crossRegions || j.region === c.region) && milesBetween(c.pos!, j.pos!) <= radiusMi,
    );

  while (left.size) {
    let best: { c: PlannerJob; members: PlannerJob[]; score: number[] } | null = null;
    for (const no of left) {
      const c = byNo.get(no)!;
      const members = near(c);
      const score = [
        members.filter(isFirm).length,
        members.length,
        members.reduce((s, m) => s + m.crewHours, 0),
      ];
      if (!best || compareScore(score, best.score) > 0 || (compareScore(score, best.score) === 0 && c.jobNo < best.c.jobNo)) {
        best = { c, members, score };
      }
    }
    const { c, members } = best!;
    for (const m of members) left.delete(m.jobNo);
    const sorted = [...members].sort((a, b) => milesBetween(c.pos!, a.pos!) - milesBetween(c.pos!, b.pos!));
    const home = nearestLocation(c.pos!, crossRegions ? undefined : c.region);
    const oneWayHours = Math.max(...sorted.map((m) => driveHours(home, m.pos!)));
    const overnight = oneWayHours > OVERNIGHT_ONE_WAY_HOURS;
    const crewHours = sorted.reduce((s, m) => s + m.crewHours, 0);
    groups.push({
      id: `g${groups.length + 1}`,
      center: c.pos!,
      jobs: sorted,
      crewHours,
      mustCount: sorted.filter(isFirm).length,
      value: sorted.reduce((s, m) => s + m.value, 0),
      home,
      oneWayHours,
      overnight,
      estDays: estimateDays(crewHours, oneWayHours, overnight),
    });
  }
  // Must-this-week groups first, then the biggest.
  return groups
    .sort((a, b) => b.mustCount - a.mustCount || b.jobs.length - a.jobs.length || b.crewHours - a.crewHours)
    .map((g, i) => ({ ...g, id: `g${i + 1}` }));
}

function compareScore(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

/** "What fits near this job": every other plannable job within `radiusMi`, nearest first. */
export function nearbyJobs(
  job: PlannerJob,
  jobs: readonly PlannerJob[],
  radiusMi: number,
  crossRegions = false,
): Array<{ job: PlannerJob; miles: number }> {
  if (!job.pos) return [];
  return jobs
    .filter((j) => j.jobNo !== job.jobNo && plannable(j) && (crossRegions || j.region === job.region))
    .map((j) => ({ job: j, miles: milesBetween(job.pos!, j.pos!) }))
    .filter((r) => r.miles <= radiusMi)
    .sort((a, b) => a.miles - b.miles);
}

// ---------------------------------------------------------------------------
// Which jobs go on the map, and their state this week.
// ---------------------------------------------------------------------------

/** Not yet ready: still in production (shown faded when asked for, never planned). */
export type MapState = PlanState | "production";

/** The service stepper's Service step (services/service-steps.ts). */
const SERVICE_STEP_KEY = "SE";

/**
 * A job's place on the map this week, or null when it doesn't belong there
 * (not tracked / not in BC / complete / already installed / nothing to install).
 *
 *  locked     — an install card in the planned week is locked (stays on its day)
 *  scheduled  — it has an install card on the board (any date)
 *  must       — in the region's "Must this week" list
 *  planned    — its Scheduled install is in the planned week (firm, like must)
 *  ready      — production done: Install (or, for a service job, Service) is the active step
 *  production — still being built
 */
export function classifyPlannerJob(j: {
  tracked: boolean;
  inBc: boolean;
  status: string;
  steps: readonly PlanStep[];
  service: boolean;
  lockedThisWeek: boolean;
  onBoard: boolean;
  mustThisWeek: boolean;
  /** Its Scheduled install falls in the planned week. */
  plannedThisWeek?: boolean;
}): { kind: "install" | "service"; state: MapState } | null {
  if (!j.tracked || !j.inBc || COMPLETE_STATUSES.has(j.status)) return null;
  const step = (key: string) => j.steps.find((s) => s.key === key);
  const install = step(INSTALL_STEP.key);
  const service = j.service ? step(SERVICE_STEP_KEY) : undefined;
  const open = (s: PlanStep | undefined) => !!s && s.state !== "completed";
  if (!open(install) && !open(service)) return null; // installed / serviced, or nothing to do on site
  const kind = j.service && open(service) ? "service" : "install";
  const ready = (kind === "service" ? service : install)?.state === "active";
  const state: MapState = j.lockedThisWeek
    ? "locked"
    : j.onBoard
      ? "scheduled"
      : j.mustThisWeek
        ? "must"
        : j.plannedThisWeek
          ? "planned"
          : ready
          ? "ready"
          : "production";
  return { kind, state };
}
