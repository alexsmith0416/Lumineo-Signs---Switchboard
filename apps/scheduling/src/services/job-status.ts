/**
 * Current Status rules for the Jobs list (pure).
 *
 * Moving a job to a status can change other things:
 *  - A status that is a stage in the job's flow (services/job-flow.ts) moves
 *    the job TO that stage: the lifecycle stages before it complete (New
 *    Order, Upcoming Mfg, Purchasing…). Departments before it complete only
 *    when the stage is past production (Ready for Install, Install, Complete-
 *    Need Paperwork, Complete to Admin…) — departments can run side by side,
 *    so "MFG - Routing" never closes Steel on its own. The flow's done status
 *    (Complete Invoiced) completes everything.
 *  - Service statuses move the SERVICE stepper (services/service-steps.ts).
 *  - Statuses outside the flow keep the older rules: Complete statuses
 *    complete every step; Installation statuses complete every step before
 *    Install, so Install becomes the active step.
 *  - Moving INTO a hold status stamps Date to Hold (today) and records the hold
 *    reason; moving OUT of one stamps Date off Hold. Days on hold from earlier
 *    holds are carried in priorHoldDays, so a second hold doesn't lose the first.
 */
import { INSTALL_STEP, PRE_PRODUCTION_KEYS, isDeptKey, isLifecycleKey, isManualOnlyKey } from "./production-steps";
import { isServiceKey } from "./service-steps";

/** Current Status options, as in the LNI Production Scheduler app (+ the
 *  lifecycle's Purchasing and Ready for Install, Oct 7). */
export const STATUS_OPTIONS: readonly string[] = [
  "New Order this week", "Upcoming Mfg.", "Purchasing", "Mfg. Ready for Planning", "Manufacturing", "Active",
  "MFG - Need Material Cut", "MFG - Routing", "MFG - Len Metal Fab", "MFG - Terry Metal Fab", "MFG - Chris Metal Fab",
  "MFG - Paint Prep / Paint", "MFG - Vinyl Cut", "MFG - Vinyl Application", "MFG - Vinyl Install",
  "MFG - Assembly", "MFG - Assembly & Graphics", "Steel MFG", "NEK - Production", "Subcontracted",
  "Outsourced - Vendor", "Ready to Send to NEK", "Ready to send to DC", "Needs Shipped",
  "Ready for Install", "Install - waiting on product", "Installation", "Complete-need paperwork", "Complete to Admin",
  "Complete Invoiced", "Hold - Customer", "Hold - Permit", "Hold - Local", "Hold - Product Ready",
  "Service or Contract Order", "Service - Hold", "Service Complete to Admin", "Morton - National", "Morton- Hold",
  "Equity Bank Upcoming", "LNI House Order", "Refurb - Awaiting Removal", "Billboards", "Surveys", "End of Active Work",
];

/** Statuses that complete every stepper step. */
export const COMPLETE_STATUSES: ReadonlySet<string> = new Set([
  "Complete-need paperwork", "Complete to Admin", "Complete Invoiced", "Service Complete to Admin",
]);

/** Statuses that complete every production step (Install is next). */
export const INSTALL_STATUSES: ReadonlySet<string> = new Set(["Installation", "Install - waiting on product"]);

export const isHoldStatus = (status: string): boolean => /hold/i.test(status);

/** Service statuses → the service steps they complete (when the job has a Service stepper). */
const SERVICE_STATUS_STEPS: Readonly<Record<string, readonly string[]>> = {
  "Service or Contract Order": ["SU"],
  "Service Complete to Admin": ["SU", "SE", "SA"],
};

type StepLike = { key: string; state: "completed" | "active" | "included" };

/**
 * The stepper steps a status completes that aren't complete yet. `steps` = the
 * job's production steps in stepper order, plus its service steps if it has
 * them; `flow` = the job's flow stages + done status (job-flow-store
 * `jobFlowConfigFor`). Without a flow only the older rules apply.
 */
export function stepsToComplete(
  status: string,
  steps: ReadonlyArray<StepLike>,
  flow?: { stages: ReadonlyArray<{ step: string; status: string }>; doneStatus: string },
): string[] {
  // Never a manual-only step (Purchasing — the purchaser ticks it).
  const keysOf = (xs: ReadonlyArray<StepLike>) => xs.filter((s) => s.state !== "completed" && !isManualOnlyKey(s.key)).map((s) => s.key);
  const service = steps.filter((s) => isServiceKey(s.key));
  const production = steps.filter((s) => !isServiceKey(s.key));

  const svc = SERVICE_STATUS_STEPS[status];
  if (svc && service.length) return keysOf(service.filter((s) => svc.includes(s.key)));

  if (flow && status) {
    const at =
      status === flow.doneStatus
        ? production.length
        : production.findIndex((p) => flow.stages.find((st) => st.status === status && production.some((x) => x.key === st.step))?.step === p.key);
    if (at >= 0) {
      const pastProduction = production.slice(at).every((s) => !isDeptKey(s.key));
      return keysOf(production.slice(0, at).filter((s) => pastProduction || isLifecycleKey(s.key)));
    }
  }

  if (COMPLETE_STATUSES.has(status)) return keysOf(production);
  if (INSTALL_STATUSES.has(status)) {
    const i = production.findIndex((s) => s.key === INSTALL_STEP.key);
    return keysOf(i < 0 ? production : production.slice(0, i));
  }
  return [];
}

/** "MFG - …", Steel MFG, NEK - Production, Manufacturing, Active — the job is in production. */
const PRODUCTION_STATUS = /^(MFG - |Steel MFG$|NEK - Production$|Manufacturing$|Active$)/;

/** Is this a production status — one of the above, or the status of a
 *  department stage in the job's flow? */
export function isProductionStatus(status: string, flow?: { stages: ReadonlyArray<{ step: string; status: string }> }): boolean {
  if (PRODUCTION_STATUS.test(status)) return true;
  const stage = flow?.stages.find((s) => s.status === status);
  return !!stage && isDeptKey(stage.step);
}

/**
 * The pre-production stages (New Order, Upcoming Mfg, Ready for Planning) a
 * status change completes (Alex, Oct 7) — never Purchasing, which only the
 * purchaser completes:
 *  - moving OFF one of their statuses ("New Order this week", "Upcoming
 *    Mfg.", "Mfg. Ready for Planning", "Purchasing") completes that stage and
 *    the ones before it — whatever the new status is (a hold included);
 *  - moving ONTO a production status completes all of them.
 * Only stages on the job's stepper that aren't complete yet.
 */
export function preProductionToComplete(
  prev: string,
  next: string,
  steps: ReadonlyArray<StepLike>,
  flow?: { stages: ReadonlyArray<{ step: string; status: string }> },
): string[] {
  const pre = steps.filter((s) => PRE_PRODUCTION_KEYS.includes(s.key));
  // Never Purchasing (manual-only) — the purchaser ticks it.
  const open = (xs: ReadonlyArray<StepLike>) => xs.filter((s) => s.state !== "completed" && !isManualOnlyKey(s.key)).map((s) => s.key);
  if (isProductionStatus(next, flow)) return open(pre);
  if (!prev || prev === next) return [];
  const left = (flow?.stages ?? []).find((s) => s.status === prev && PRE_PRODUCTION_KEYS.includes(s.step))?.step;
  if (!left) return [];
  const upTo = PRE_PRODUCTION_KEYS.indexOf(left);
  return open(pre.filter((s) => PRE_PRODUCTION_KEYS.indexOf(s.key) <= upTo));
}

/**
 * Lifecycle stages a job has clearly moved past but that aren't ticked — for
 * the one-time backfill when the lifecycle stages arrived (Oct 7, 2026). A
 * lifecycle stage counts as passed when a LATER step on the stepper is
 * complete (Metal Fab done ⇒ past New Order, Upcoming Mfg, Purchasing).
 * Where the Current Status puts the job is stepsToComplete's job; together
 * they cover jobs with completions and jobs with none. Departments are never
 * touched here.
 */
export function passedLifecycleSteps(production: ReadonlyArray<StepLike>): string[] {
  let furthest = -1;
  production.forEach((s, i) => {
    if (s.state === "completed") furthest = i;
  });
  return production
    .slice(0, Math.max(0, furthest))
    .filter((s) => s.state !== "completed" && isLifecycleKey(s.key) && !isManualOnlyKey(s.key))
    .map((s) => s.key);
}

export interface HoldFields {
  holdReason: string;
  dateToHold: string;
  dateOffHold: string;
  priorHoldDays: number;
}

const DAY = 86_400_000;
const dayOf = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const days = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY));

/** Days the job has spent on hold: earlier holds + the latest one (to today while it lasts). */
export function daysOnHold(t: Pick<HoldFields, "dateToHold" | "dateOffHold" | "priorHoldDays">, today: Date): number {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const held = dayOf(t.dateToHold);
  const current = held ? days(held, dayOf(t.dateOffHold) ?? now) : 0;
  return (t.priorHoldDays || 0) + current;
}

/**
 * The hold fields after a status change from `prev` to `next` (on `today`,
 * "YYYY-MM-DD"). Returns only what changes — {} when neither is a hold.
 */
export function holdTransition(t: HoldFields, prev: string, next: string, today: string): Partial<HoldFields> {
  const wasHeld = isHoldStatus(prev);
  const nowHeld = isHoldStatus(next);
  if (nowHeld && !wasHeld) {
    // A new hold. A previous, finished hold's days move into priorHoldDays.
    const to = dayOf(t.dateToHold);
    const off = dayOf(t.dateOffHold);
    const carried = to && off ? days(to, off) : 0;
    return {
      holdReason: next,
      dateToHold: today,
      dateOffHold: "",
      ...(carried ? { priorHoldDays: (t.priorHoldDays || 0) + carried } : {}),
    };
  }
  if (wasHeld && !nowHeld) return { dateOffHold: today };
  if (nowHeld && next !== t.holdReason) return { holdReason: next }; // one hold → another: same hold, new reason
  return {};
}

export interface StatusBackfillItem {
  jobNo: string;
  status: string;
  /** Step keys to complete. */
  keys: string[];
  /** Every step the job's stepper has (for the job-complete check). */
  allKeys: string[];
  /** complete / install = a complete or installation status; lifecycle = any
   *  other job further along its flow (mostly the lifecycle stages it has
   *  passed: New Order, Upcoming Mfg, Purchasing…). */
  kind: "complete" | "install" | "lifecycle";
}

type FlowFor = (jobNo: string, steps: ReadonlyArray<StepLike>) =>
  { stages: ReadonlyArray<{ step: string; status: string }>; doneStatus: string } | undefined;

/**
 * The backfill ("Match steppers"): for every job, the steps its Current Status
 * says should already be complete (stepsToComplete, through the job's flow
 * when `flowFor` is given) plus the lifecycle stages it has moved past
 * (passedLifecycleSteps). Jobs with nothing to do are left out.
 */
export function planStatusBackfill(
  rows: ReadonlyArray<{ jobNo: string; status: string }>,
  stepsFor: (jobNo: string) => ReadonlyArray<StepLike>,
  flowFor?: FlowFor,
): StatusBackfillItem[] {
  const out: StatusBackfillItem[] = [];
  for (const r of rows) {
    const steps = stepsFor(r.jobNo);
    const flow = flowFor?.(r.jobNo, steps);
    const byStatus = stepsToComplete(r.status, steps, flow);
    const passed = passedLifecycleSteps(steps.filter((s) => !isServiceKey(s.key)));
    // On a production status (even one outside the flow): every pre-production stage.
    const pre = preProductionToComplete("", r.status, steps, flow);
    const keys = [...new Set([...byStatus, ...passed, ...pre])];
    if (!keys.length) continue;
    const kind = COMPLETE_STATUSES.has(r.status) ? "complete" : INSTALL_STATUSES.has(r.status) ? "install" : "lifecycle";
    out.push({ jobNo: r.jobNo, status: r.status, keys, allKeys: steps.map((s) => s.key), kind });
  }
  return out;
}
