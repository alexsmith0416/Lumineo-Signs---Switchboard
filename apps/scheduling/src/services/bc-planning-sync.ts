/**
 * BC planning-step write-back — payload builders (pure).
 *
 * The scheduler is the authority for the START/END window, the ASSIGNEE, and
 * the COMPLETE state of a job's production + install steps in Business
 * Central's Project Planning. When a user commits one of those on the board we
 * push it to BC so the BC Project Planning list mirrors the board.
 *
 * This module is PURE — it only turns app state into a transport-agnostic
 * `BcPlanningPush`. The write is `enqueueBcPush()` in `dataverse-live.ts`
 * (an outbox row) + the BCPush_PlanningSteps flow, which PATCHes (or creates)
 * the row in our own BC web service `LumineoProjectPlanning` (page 58400 over
 * ICG.IPP.ProjectPlanning, bc/lumineo-planning-ext).
 *
 * ── Granularity ──────────────────────────────────────────────────────────────
 * A board card is one BC *planning line* ("Cabinet Metal Labor") in one app
 * *department*. BC's Project Planning row is one *catalogue step* per job
 * ("Fabrication"), and several departments fold into one step (Steel MFG,
 * Metal Fab and Fabrication Help all → Fabrication). So a push is per
 * (job, BC step), and its window is the earliest start → latest end over EVERY
 * card of the job that maps to that step — computed at enqueue time from
 * Dataverse (not the loaded week), which also makes each push idempotent.
 */
import type { ScheduleLine } from "../engine/types";
import { DEPT_FLOW, INSTALL_STEP, isDeptKey } from "./production-steps";
import { SERVICE_COMPLETE_TO_ADMIN } from "./service-steps";

/** `"schedule"` = a step's dates/assignee; `"state"` = a step's Started /
 *  Complete from the production stepper; `"job"` = the BC job's own complete
 *  flag. (`"completion"` is the retired pre-Sep-28 shape — never written now.) */
export type BcPushKind = "schedule" | "state" | "completion" | "job";

/** A transport-agnostic instruction to update one BC planning step (or, for
 *  `"job"`, the BC job itself). */
export interface BcPlanningPush {
  kind: BcPushKind;
  /** BC project/job number — the row's Project_No. */
  jobNo: string;
  /** BC CATALOGUE step name (e.g. "Fabrication") — the row's Step_Description.
   *  The flow matches on it (step GUIDs differ per BC environment) and creates
   *  the row when the job has none for this step. Empty for `"job"`. */
  planningStep: string;
  /** App department key / stepper key the push came from — traceability. */
  deptKey: string;
  /** ISO 8601 UTC, or null when this push doesn't set the time (completion). */
  startDateTime: string | null;
  endDateTime: string | null;
  /** BC resource number, or "" to leave BC's assignee untouched (team lanes,
   *  several people on the step, install crews without a crfdf_no). */
  assignedTo: string;
  assignedToName: string;
  complete: boolean;
  /** BC's Started, on `"state"` pushes only. In BC, Started means "listed in
   *  this department's queue" — the department tiles show steps that are
   *  Started and not Complete — so it mirrors the stepper's ACTIVE stage(s).
   *  Scheduling never touches it. */
  started: boolean;
  /** Source schedule-line id — traceability + de-dupe in the outbox. */
  sourceLineId: string;
}

const validDate = (d: Date | null | undefined): d is Date =>
  d instanceof Date && !Number.isNaN(d.getTime());
const iso = (d: Date | null | undefined): string | null => (validDate(d) ? d.toISOString() : null);

/**
 * App stepper key → BC catalogue step (the 35-step list in table 71441976,
 * matched by its Description). Agreed Sep 28, 2026; Material Cut and Crating
 * added Sep 30. BC steps with no app department — Assembly Wiring, Face
 * Production, Final Inspection — are never written.
 */
export const BC_STEP_FOR_KEY: Readonly<Record<string, string>> = {
  MC: "Substrate Cut/Prep", // Material Cut
  S: "Fabrication", // Steel MFG
  R: "Routing",
  MF: "Fabrication", // Metal Fab
  P: "Painting",
  V: "Vinyl", // Vinyl / Graphics
  A: "Final Assembly",
  CR: "Crating",
  [INSTALL_STEP.key]: "Install",
  // The Service stepper's Service step. (The lifecycle steps — New Order This
  // Week … Complete-Need Paperwork — follow the Current Status instead:
  // services/status-lifecycle.ts. Survey stays in the app: BC has two "Survey"
  // steps, so a write by name is refused.)
  SE: "Service",
};

/** BC step for a stepper key, or null when that key has no BC step. */
export function bcStepForKey(key: string | null | undefined): string | null {
  return (key && BC_STEP_FOR_KEY[key]) || null;
}

/** BC step for a production department NAME. "Fabrication Help" isn't a
 *  stepper department but its work is fabrication, so it folds in too. */
export function bcStepForDepartmentName(name: string | null | undefined): string | null {
  if (!name) return null;
  if (/fabricat/i.test(name)) return "Fabrication";
  return bcStepForKey(DEPT_FLOW.find((d) => d.match.test(name))?.key);
}

/**
 * Whether a schedule line should sync to BC. Custom cards (PTO, group
 * containers) and lines with no BC job number have no planning step behind
 * them, so they never sync.
 */
export function shouldSyncLine(line: Pick<ScheduleLine, "jobNo" | "isCustom">): boolean {
  return Boolean(line.jobNo) && !line.isCustom;
}

export interface StepWindow {
  start: Date;
  end: Date;
  /** The one BC resource no on the step, or "" when none / several people. */
  assignedTo: string;
}

/**
 * The BC step window for a set of cards that all map to ONE (job, step):
 * earliest start → latest end. The assignee is only set when every card that
 * names a person names the SAME person — BC holds one assignee per step, and
 * picking one of several would be a guess. Null when no card has a usable
 * window (nothing to push; BC is left as it is rather than cleared).
 */
export function stepWindow(
  lines: ReadonlyArray<Pick<ScheduleLine, "jobNo" | "isCustom" | "startDateTime" | "endDateTime" | "employeeId">>,
  resourceNoFor: (employeeId: string) => string,
): StepWindow | null {
  let start: Date | null = null;
  let end: Date | null = null;
  const people = new Set<string>();
  for (const l of lines) {
    if (!shouldSyncLine(l)) continue;
    const s = l.startDateTime;
    const e = l.endDateTime;
    if (!validDate(s) || !validDate(e)) continue;
    if (!start || s < start) start = s;
    if (!end || e > end) end = e;
    const r = l.employeeId ? resourceNoFor(l.employeeId) : "";
    if (r) people.add(r);
  }
  if (!start || !end) return null;
  return { start, end, assignedTo: people.size === 1 ? [...people][0]! : "" };
}

/** A login from the app-user directory (crfdf_appuser), as the name lookup needs it. */
export interface BcPerson {
  displayName: string;
  userType: string;
  /** BC Resource No. (crfdf_no). */
  bcNo: string;
}

const words = (n: string): string[] => n.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * BC Resource No. for an install-crew roster name. The install roster uses
 * short names ("Doug", "Justin F", "Kevin B"), so this matches the FIRST name
 * and, when given, the last-name INITIAL against the app-user directory.
 * Several matches → prefer install-role logins ("Thomas" is Thomas Dunson the
 * installer, not Thomas Sellers in admin). Still ambiguous, or no match (a
 * placeholder row like "Misc Jobs", a nickname like "Danny" for Daniel) → ""
 * so BC's assignee is left alone rather than guessed.
 */
export function resourceNoByName(name: string, people: readonly BcPerson[]): string {
  const [first, ...rest] = words(name);
  if (!first) return "";
  // "Justin F" → any surname starting F; "Lee McQueen" → surname McQueen.
  const last = rest.at(-1);
  const surnameFits = (surnames: string[]): boolean =>
    !last || surnames.some((x) => (last.length === 1 ? x.startsWith(last) : x === last));
  let hits = people.filter((p) => {
    const [pFirst, ...pRest] = words(p.displayName);
    return Boolean(p.bcNo) && pFirst === first && surnameFits(pRest);
  });
  if (hits.length > 1) {
    const install = hits.filter((p) => p.userType.startsWith("install"));
    if (install.length) hits = install;
  }
  return hits.length === 1 ? hits[0]!.bcNo : "";
}

/** A schedule push for one (job, BC step) from its computed window. */
export function buildStepSchedulePush(input: {
  jobNo: string;
  step: string | null;
  window: StepWindow | null;
  deptKey?: string;
  sourceLineId?: string;
}): BcPlanningPush | null {
  if (!input.jobNo || !input.step || !input.window) return null;
  return {
    kind: "schedule",
    jobNo: input.jobNo,
    planningStep: input.step,
    deptKey: input.deptKey ?? "",
    startDateTime: iso(input.window.start),
    endDateTime: iso(input.window.end),
    assignedTo: input.window.assignedTo,
    assignedToName: "",
    complete: false,
    started: false,
    sourceLineId: input.sourceLineId ?? "",
  };
}

export interface BcStepState {
  step: string;
  started: boolean;
  complete: boolean;
  /** The stepper keys folded into this step, e.g. ["S", "MF"] for Fabrication. */
  keys: string[];
}

/**
 * BC Started / Complete for every BC step a job's stepper includes. The
 * stepper is the source of truth (agreed Sep 28, 2026):
 *   - Complete  = EVERY included department that maps to the step is done, so
 *     finishing Metal Fab doesn't close Fabrication while Steel is still going.
 *   - Started   = the step is complete, or ANY of its departments is active.
 *     Several departments can be active at once. A department that stops being
 *     active without finishing goes back to not Started, so a project only
 *     shows in the tile(s) of the department(s) it is actually in.
 * Departments the stepper doesn't include are left out — BC is not touched.
 *
 * Plus BC's two MAIN steps (agreed Sep 30, 2026), which head their sections:
 *   - "Production": Started once any production step is Started; Complete
 *     once every production step is complete. Only for a job with production
 *     steps.
 *   - "Installation/Service": Started once Install is active (production done,
 *     or the job moved to an Installation status); Complete once Install is
 *     complete (a Complete status completes it). Only for a job with Install.
 */
export function bcStepStates(
  steps: ReadonlyArray<{ key: string; state: "completed" | "active" | "included" }>,
): BcStepState[] {
  const byStep = new Map<string, BcStepState>();
  for (const d of steps) {
    const step = bcStepForKey(d.key);
    if (!step) continue;
    let st = byStep.get(step);
    if (!st) byStep.set(step, (st = { step, started: false, complete: true, keys: [] }));
    st.keys.push(d.key);
    if (d.state !== "completed") st.complete = false;
    if (d.state === "active") st.started = true;
  }
  for (const st of byStep.values()) if (st.complete) st.started = true;

  const main = (step: string, of: typeof steps): BcStepState | null => {
    if (!of.length) return null;
    const complete = of.every((d) => d.state === "completed");
    return {
      step,
      complete,
      started: complete || of.some((d) => d.state === "active" || d.state === "completed"),
      keys: of.map((d) => d.key),
    };
  };
  // The main Production step heads the DEPARTMENTS only — not the lifecycle stages.
  const production = main(BC_PRODUCTION_STEP, steps.filter((d) => isDeptKey(d.key) && bcStepForKey(d.key)));
  const install = main(BC_INSTALLATION_STEP, steps.filter((d) => d.key === INSTALL_STEP.key));
  return [...(production ? [production] : []), ...byStep.values(), ...(install ? [install] : [])];
}

/** BC's main Production step (heads the production departments). */
export const BC_PRODUCTION_STEP = "Production";
/** BC's main Installation step (heads Install and the other install steps). */
export const BC_INSTALLATION_STEP = "Installation/Service";

/** A Started/Complete push for one (job, BC step). `completedBy` = the BC
 *  Resource No. of the person who moved it on — written to BC's Completed By
 *  when the step becomes Complete. It rides in the outbox's assignee column,
 *  which state pushes don't otherwise use (BCPush_PlanningSteps reads it as
 *  Completed_By on a state row). "" = leave Completed By as it is. */
export function buildStepStatePush(input: {
  jobNo: string;
  state: BcStepState;
  by?: string;
  completedBy?: string;
}): BcPlanningPush | null {
  if (!input.jobNo) return null;
  return {
    kind: "state",
    jobNo: input.jobNo,
    planningStep: input.state.step,
    deptKey: input.state.keys.join(","),
    startDateTime: null,
    endDateTime: null,
    assignedTo: input.state.complete ? input.completedBy ?? "" : "",
    assignedToName: input.by ?? "",
    complete: input.state.complete,
    started: input.state.started,
    sourceLineId: "",
  };
}

/**
 * Whether every step the stepper shows for a job is complete.
 *
 * `allStepKeys` is the stepper's *included* set (BC-derived departments +
 * editor overrides + Install), so a dept an editor removed can't hold the job
 * open. An empty step list is NOT complete — a job with no stepper at all
 * hasn't finished anything, and treating it as done would push `complete` to BC
 * for every non-production job.
 */
export function allStepsComplete(
  allStepKeys: readonly string[],
  completedKeys: ReadonlySet<string>,
): boolean {
  if (allStepKeys.length === 0) return false;
  return allStepKeys.every((k) => completedKeys.has(k));
}

/**
 * Does a STEPPER change complete the job for BC's job "complete" flag? Since
 * Oct 7, 2026 the flag follows the Current Status — moving to Complete to
 * Admin sets it (job-tracking-store `setStatus`) — so production steps never
 * decide it. Only a service job's own Service-stepper "Complete to Admin"
 * (SA) still does. `allStepKeys` = every step the job's steppers show.
 */
export function jobCompleteForBc(allStepKeys: readonly string[], completedKeys: ReadonlySet<string>): boolean {
  return allStepKeys.includes(SERVICE_COMPLETE_TO_ADMIN) && completedKeys.has(SERVICE_COMPLETE_TO_ADMIN);
}

/**
 * Build a JOB-level completion push — the one BC write-back that works today.
 *
 * Targets `jobs('<jobNo>')` on the sign365 API, which is writable and keyed on
 * `no`. Only `complete` and the completion date are consumed by the flow;
 * `started`/`assignedTo`/`planningStep` are step-level concepts and are left
 * blank. The completion date rides in `endDateTime` so the outbox needs no new
 * column.
 *
 * Deliberately does NOT carry BC's `status` field: flipping a job to
 * `Completed` in BC has posting/billing consequences that belong to whoever
 * runs BC, not to a board click. Ask before adding it.
 */
export function buildJobPush(input: {
  jobNo: string;
  complete: boolean;
  completedBy?: string;
  completedDate?: Date | null;
}): BcPlanningPush | null {
  if (!input.jobNo) return null;
  return {
    kind: "job",
    jobNo: input.jobNo,
    planningStep: "",
    deptKey: "",
    startDateTime: null,
    // Completion date for BC's icgSgpCompletionDate; null when re-opening.
    endDateTime: input.complete ? iso(input.completedDate ?? new Date()) : null,
    assignedTo: "",
    assignedToName: input.completedBy ?? "",
    complete: input.complete,
    started: true,
    sourceLineId: "",
  };
}

/** Human-readable primary-name for the outbox row. */
export function pushRowName(p: BcPlanningPush): string {
  const step = p.planningStep || p.deptKey || p.kind;
  return `${p.jobNo} · ${step}`.slice(0, 100);
}
