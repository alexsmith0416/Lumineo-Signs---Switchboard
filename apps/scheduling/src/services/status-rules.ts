/**
 * Step → Current Status rules (pure).
 *
 * When a department completes from the shop floor (a "Task complete" tick on
 * a BC job punch), the job's Current Status moves to the status of its NEW
 * active stepper step. The table is editable in Settings → Status rules
 * (Admin / Ops / Developer); these are the defaults.
 *
 * Only jobs on a normal production status move. Holds and special statuses
 * (Service, Morton, Billboards, Refurb, Complete to Admin / Invoiced…) are
 * left for people to change. Later, sign type / sign order can refine this.
 */
import { INSTALL_STEP } from "./production-steps";
import { isHoldStatus } from "./job-status";

/** The rule key for "every step complete". */
export const ALL_DONE = "done";

/** Stepper step key (or ALL_DONE) → the Current Status it means. */
export type StatusRules = Readonly<Record<string, string>>;

export const DEFAULT_STATUS_RULES: StatusRules = {
  // Lifecycle stages (Oct 7, 2026). Complete to Admin is the production team
  // handing the paperwork over, so while it's open the job still reads
  // "Complete-need paperwork"; once it's done the job is with Admin
  // ("Complete to Admin") until invoiced ("Complete Invoiced" = every step done).
  NO: "New Order this week",
  UM: "Upcoming Mfg.",
  PU: "Purchasing",
  MC: "MFG - Need Material Cut",
  S: "Steel MFG",
  R: "MFG - Routing",
  MF: "MFG - Len Metal Fab",
  P: "MFG - Paint Prep / Paint",
  V: "MFG - Vinyl Cut",
  A: "MFG - Assembly",
  CR: "Needs Shipped",
  RI: "Ready for Install",
  [INSTALL_STEP.key]: "Install - waiting on product",
  CP: "Complete-need paperwork",
  CA: "Complete-need paperwork",
  CI: "Complete to Admin",
  [ALL_DONE]: "Complete Invoiced",
};

/** The "every step done" status before the lifecycle stages existed. */
export const OLD_DONE_STATUS = "Complete-need paperwork";

/** Production statuses besides the rule targets that may also be moved on. */
const ALSO_MOVABLE = [
  "—", "New Order this week", "Upcoming Mfg.", "Mfg. Ready for Planning", "Manufacturing", "Active",
  "MFG - Terry Metal Fab", "MFG - Chris Metal Fab", "MFG - Vinyl Application", "MFG - Vinyl Install",
  "MFG - Assembly & Graphics", "NEK - Production", "Installation",
];

/** Statuses the automation never moves a job off. */
const NEVER_MOVED: ReadonlySet<string> = new Set(["Complete Invoiced"]);

/** The rules, with any missing key filled from the defaults. */
export function withDefaults(rules: Partial<Record<string, string>> | null | undefined): StatusRules {
  const out: Record<string, string> = { ...DEFAULT_STATUS_RULES };
  for (const [k, v] of Object.entries(rules ?? {})) if (typeof v === "string" && v.trim()) out[k] = v.trim();
  return out;
}

/** May a job on this status be moved automatically? */
export function isAutoMovable(status: string, rules: StatusRules): boolean {
  return isAutoMovableStatus(status, Object.values(rules));
}

/** May a job on this status be moved automatically, given the statuses a flow uses?
 *  Holds never are; nor are statuses outside the flow and the usual production ones. */
export function isAutoMovableStatus(status: string, flowStatuses: readonly string[]): boolean {
  // A finished job (invoiced) is never moved by a punch, even though it's the flow's done status.
  if (!status || isHoldStatus(status) || NEVER_MOVED.has(status)) return false;
  return flowStatuses.includes(status) || ALSO_MOVABLE.includes(status);
}

/**
 * The status a job should move to now that its stepper looks like `steps`
 * (after the completion) — or null to leave it: not a movable status, no
 * steps, no rule, or already there. The first ACTIVE step in flow order
 * decides; every step complete → the ALL_DONE rule.
 */
export function nextStatus(
  steps: ReadonlyArray<{ key: string; state: "completed" | "active" | "included" }>,
  current: string,
  rules: StatusRules,
): string | null {
  if (!steps.length || !isAutoMovable(current, rules)) return null;
  const active = steps.find((s) => s.state === "active");
  const target = active ? rules[active.key] : steps.every((s) => s.state === "completed") ? rules[ALL_DONE] : undefined;
  return target && target !== current ? target : null;
}
