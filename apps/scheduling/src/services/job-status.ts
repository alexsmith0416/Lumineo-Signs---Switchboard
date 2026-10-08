/**
 * Current Status rules for the Jobs list (pure).
 *
 * The Current Status IS the job's lifecycle (Oct 7, 2026 — BC's lifecycle
 * steps follow it: services/status-lifecycle.ts). On the stepper (departments
 * + Install) a status move does this:
 *  - Complete statuses (Complete-need paperwork, Complete to Admin, Complete
 *    Invoiced, Service Complete to Admin) complete every step.
 *  - Install statuses (Install - Ready for Planning, Install - waiting on
 *    product, Installation) complete every step before Install, so Install is
 *    the active step.
 *  - MFG - Vinyl Install completes every step before Vinyl, and Install is
 *    marked active too — Vinyl AND Install active = the vinyl tech installs
 *    (job-tracking-store sets / clears that).
 *  - Moving BACK from a complete status to an install / production one
 *    re-opens Install (stepsToReopen).
 *  - Service statuses move the SERVICE stepper (services/service-steps.ts).
 *  - Moving INTO a hold status stamps Date to Hold (today) and records the hold
 *    reason; moving OUT of one stamps Date off Hold. Days on hold from earlier
 *    holds are carried in priorHoldDays, so a second hold doesn't lose the first.
 */
import { INSTALL_STEP } from "./production-steps";
import { isServiceKey } from "./service-steps";
import { STATUS, isVinylInstall, statusRank } from "./status-lifecycle";

/** Current Status options, as in the LNI Production Scheduler app (+ "Install
 *  - Ready for Planning", Oct 7 — ready for install scheduling). */
export const STATUS_OPTIONS: readonly string[] = [
  "New Order this week", "Upcoming Mfg.", "Mfg. Ready for Planning", "Manufacturing", "Active",
  "MFG - Need Material Cut", "MFG - Routing", "MFG - Len Metal Fab", "MFG - Terry Metal Fab", "MFG - Chris Metal Fab",
  "MFG - Paint Prep / Paint", "MFG - Vinyl Cut", "MFG - Vinyl Application", "MFG - Vinyl Install",
  "MFG - Assembly", "MFG - Assembly & Graphics", "Steel MFG", "NEK - Production", "Subcontracted",
  "Outsourced - Vendor", "Ready to Send to NEK", "Ready to send to DC", "Needs Shipped",
  "Install - Ready for Planning", "Install - waiting on product", "Installation", "Complete-need paperwork", "Complete to Admin",
  "Complete Invoiced", "Hold - Customer", "Hold - Permit", "Hold - Local", "Hold - Product Ready",
  "Service or Contract Order", "Service - Hold", "Service Complete to Admin", "Morton - National", "Morton- Hold",
  "Equity Bank Upcoming", "LNI House Order", "Refurb - Awaiting Removal", "Billboards", "Surveys", "End of Active Work",
];

/** Statuses that complete every stepper step. */
export const COMPLETE_STATUSES: ReadonlySet<string> = new Set([
  "Complete-need paperwork", "Complete to Admin", "Complete Invoiced", "Service Complete to Admin",
]);

/** Statuses that complete every production step (Install is next). */
export const INSTALL_STATUSES: ReadonlySet<string> = new Set([
  "Install - Ready for Planning", "Install - waiting on product", "Installation",
]);

export const isHoldStatus = (status: string): boolean => /hold/i.test(status);

const has = (set: ReadonlySet<string>, status: string) => [...set].some((s) => s.toLowerCase() === status.trim().toLowerCase());
export const isCompleteStatus = (status: string): boolean => has(COMPLETE_STATUSES, status);
export const isInstallStatus = (status: string): boolean => has(INSTALL_STATUSES, status);

/** Service statuses → the service steps they complete (when the job has a Service stepper). */
const SERVICE_STATUS_STEPS: Readonly<Record<string, readonly string[]>> = {
  "Service or Contract Order": ["SU"],
  "Service Complete to Admin": ["SU", "SE", "SA"],
};

type StepLike = { key: string; state: "completed" | "active" | "included" };

/**
 * The stepper steps a status completes that aren't complete yet. `steps` = the
 * job's production steps in stepper order, plus its service steps if it has
 * them.
 */
export function stepsToComplete(status: string, steps: ReadonlyArray<StepLike>): string[] {
  const keysOf = (xs: ReadonlyArray<StepLike>) => xs.filter((s) => s.state !== "completed").map((s) => s.key);
  const service = steps.filter((s) => isServiceKey(s.key));
  const production = steps.filter((s) => !isServiceKey(s.key));

  const svc = SERVICE_STATUS_STEPS[status];
  if (svc && service.length) return keysOf(service.filter((s) => svc.includes(s.key)));

  if (isCompleteStatus(status)) return keysOf(production);
  const before = (key: string) => {
    const i = production.findIndex((s) => s.key === key);
    return i < 0 ? [] : production.slice(0, i);
  };
  if (isInstallStatus(status)) {
    const i = production.findIndex((s) => s.key === INSTALL_STEP.key);
    return keysOf(i < 0 ? production : production.slice(0, i));
  }
  if (isVinylInstall(status)) return keysOf(before("V"));
  return [];
}

/**
 * Steps a status move re-opens: moving BACK from Complete-need paperwork or
 * later to an install / production status re-opens Install (BC follows —
 * services/status-lifecycle.ts re-opens the later lifecycle steps too).
 * Departments are never re-opened by a status (they run side by side).
 */
export function stepsToReopen(prev: string, next: string, steps: ReadonlyArray<StepLike>): string[] {
  const from = statusRank(prev);
  const to = statusRank(next);
  if (from === null || to === null || to >= 6 || from < 6) return [];
  return steps.filter((s) => s.key === INSTALL_STEP.key && s.state === "completed").map((s) => s.key);
}

/** Lifecycle dates a status move fills in ("YYYY-MM-DD" today): Date Installed
 *  when a job reaches Complete-need paperwork or later and has none yet; Date
 *  to Admin whenever it moves to Complete to Admin. */
export function statusDates(
  next: string,
  t: { dateInstalled: string; dateToAdmin: string },
  today: string,
): { dateInstalled?: string; dateToAdmin?: string } {
  const r = statusRank(next);
  const out: { dateInstalled?: string; dateToAdmin?: string } = {};
  if (r !== null && r >= 6 && !t.dateInstalled) out.dateInstalled = today;
  if (next.trim().toLowerCase() === STATUS.toAdmin.toLowerCase()) out.dateToAdmin = today;
  return out;
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
  /** Every step the job's steppers have (for the job-complete check). */
  allKeys: string[];
  kind: "complete" | "install" | "vinyl";
}

/**
 * The backfill ("Match steppers"): for every job whose Current Status is a
 * complete, install or vinyl-install status, the stepper steps that status
 * says should already be complete but aren't. Jobs with nothing to do are
 * left out.
 */
export function planStatusBackfill(
  rows: ReadonlyArray<{ jobNo: string; status: string }>,
  stepsFor: (jobNo: string) => ReadonlyArray<StepLike>,
): StatusBackfillItem[] {
  const out: StatusBackfillItem[] = [];
  for (const r of rows) {
    const kind = isCompleteStatus(r.status) ? "complete" : isInstallStatus(r.status) ? "install" : isVinylInstall(r.status) ? "vinyl" : null;
    if (!kind) continue;
    const steps = stepsFor(r.jobNo);
    const keys = stepsToComplete(r.status, steps);
    if (keys.length) out.push({ jobNo: r.jobNo, status: r.status, keys, allKeys: steps.map((s) => s.key), kind });
  }
  return out;
}
