/**
 * Current Status rules for the Jobs list (pure).
 *
 * Moving a job to a status can change other things:
 *  - Complete statuses complete EVERY stepper step (production + Install).
 *  - Installation statuses complete every PRODUCTION step, so Install becomes
 *    the active step.
 *  - Moving INTO a hold status stamps Date to Hold (today) and records the hold
 *    reason; moving OUT of one stamps Date off Hold. Days on hold from earlier
 *    holds are carried in priorHoldDays, so a second hold doesn't lose the first.
 */
import { INSTALL_STEP } from "./production-steps";

/** Current Status options, as in the LNI Production Scheduler app. */
export const STATUS_OPTIONS: readonly string[] = [
  "New Order this week", "Upcoming Mfg.", "Mfg. Ready for Planning", "Manufacturing", "Active",
  "MFG - Need Material Cut", "MFG - Routing", "MFG - Len Metal Fab", "MFG - Terry Metal Fab", "MFG - Chris Metal Fab",
  "MFG - Paint Prep / Paint", "MFG - Vinyl Cut", "MFG - Vinyl Application", "MFG - Vinyl Install",
  "MFG - Assembly", "MFG - Assembly & Graphics", "Steel MFG", "NEK - Production", "Subcontracted",
  "Outsourced - Vendor", "Ready to Send to NEK", "Ready to send to DC", "Needs Shipped",
  "Install - waiting on product", "Installation", "Complete-need paperwork", "Complete to Admin",
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

/** The stepper steps a status completes that aren't complete yet. */
export function stepsToComplete(
  status: string,
  steps: ReadonlyArray<{ key: string; state: "completed" | "active" | "included" }>,
): string[] {
  const open = steps.filter((s) => s.state !== "completed");
  if (COMPLETE_STATUSES.has(status)) return open.map((s) => s.key);
  if (INSTALL_STATUSES.has(status)) return open.filter((s) => s.key !== INSTALL_STEP.key).map((s) => s.key);
  return [];
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
  kind: "complete" | "install";
}

/**
 * The backfill: for every job whose Current Status is a complete or
 * installation status, the stepper steps that status says should already be
 * complete but aren't. Jobs with nothing to do are left out.
 */
export function planStatusBackfill(
  rows: ReadonlyArray<{ jobNo: string; status: string }>,
  stepsFor: (jobNo: string) => ReadonlyArray<{ key: string; state: "completed" | "active" | "included" }>,
): StatusBackfillItem[] {
  const out: StatusBackfillItem[] = [];
  for (const r of rows) {
    const kind = COMPLETE_STATUSES.has(r.status) ? "complete" : INSTALL_STATUSES.has(r.status) ? "install" : null;
    if (!kind) continue;
    const steps = stepsFor(r.jobNo);
    const keys = stepsToComplete(r.status, steps);
    if (keys.length) out.push({ jobNo: r.jobNo, status: r.status, keys, allKeys: steps.map((s) => s.key), kind });
  }
  return out;
}
