/**
 * The job LIFECYCLE is the Current Status (Alex, Oct 7, 2026). Moving a job's
 * status moves BC's lifecycle steps in Project Planning — the stepper itself
 * is only the departments + Install. Pure.
 *
 *   status                          BC lifecycle steps
 *   New Order this week             New Order This Week Started
 *   Upcoming Mfg.                   + it Complete; Upcoming Manufacturing Started
 *   Mfg. Ready for Planning         + Manufacturing Ready for Planning Started
 *   a production status             every step above Complete
 *   Install - Ready for Planning    Product Ready for Install Scheduling Started
 *                                   (stepper: Install active; BC Install NOT started)
 *   Install - waiting on product    Install-Waiting on Product Started
 *   Installation                    Product Ready… Complete; BC Install Started
 *   MFG - Vinyl Install             Vinyl Install Only Started, Vinyl Complete
 *                                   (stepper: Vinyl AND Install active)
 *   Complete-need paperwork         Complete-Need Paperwork Started (Install done)
 *   Complete to Admin / Invoiced    Complete-Need Paperwork Complete
 *
 * Moving BACKWARD re-opens: steps past the new status go back to not Started /
 * not Complete (the push flow does nothing for a step BC has no row for).
 * Purchasing isn't tracked by the app at all. Holds and other statuses outside
 * the list (Needs Shipped, Ready to send to NEK, Service…) change nothing.
 */
import type { BcStepState } from "./bc-planning-sync";

export const STATUS = {
  newOrder: "New Order this week",
  upcoming: "Upcoming Mfg.",
  readyForPlanning: "Mfg. Ready for Planning",
  installReady: "Install - Ready for Planning",
  installWaiting: "Install - waiting on product",
  installation: "Installation",
  vinylInstall: "MFG - Vinyl Install",
  needPaperwork: "Complete-need paperwork",
  toAdmin: "Complete to Admin",
  invoiced: "Complete Invoiced",
} as const;

/** BC lifecycle step names (Project Planning catalogue). */
export const BC_LIFECYCLE = {
  newOrder: "New Order This Week",
  upcoming: "Upcoming Manufacturing",
  readyForPlanning: "Manufacturing Ready for Planning",
  installReady: "Product Ready for Install Scheduling",
  installWaiting: "Install-Waiting on Product",
  vinylInstallOnly: "Vinyl Install Only",
  needPaperwork: "Complete-Need Paperwork",
} as const;

const norm = (s: string) => s.trim().toLowerCase();
const is = (status: string, name: string) => norm(status) === norm(name);

/** "MFG - …", Steel MFG, NEK - Production, Manufacturing, Active, Subcontracted, Outsourced - Vendor. */
const PRODUCTION = /^(mfg - |steel mfg$|nek - production$|manufacturing$|active$|subcontracted$|outsourced - vendor$)/;
export const isProductionStatus = (status: string): boolean => PRODUCTION.test(norm(status));
export const isVinylInstall = (status: string): boolean => is(status, STATUS.vinylInstall);

/**
 * Where a status sits in the lifecycle — null for statuses that don't move it
 * (holds, Service, Needs Shipped…):
 * 0 New Order · 1 Upcoming · 2 Ready for Planning · 3 production ·
 * 4 Install - Ready for Planning / waiting on product · 5 Installation ·
 * 6 Complete-need paperwork · 7 Complete to Admin · 8 Complete Invoiced.
 */
export function statusRank(status: string): number | null {
  if (!status) return null;
  if (is(status, STATUS.newOrder)) return 0;
  if (is(status, STATUS.upcoming)) return 1;
  if (is(status, STATUS.readyForPlanning)) return 2;
  if (is(status, STATUS.installReady) || is(status, STATUS.installWaiting)) return 4;
  if (is(status, STATUS.installation)) return 5;
  if (is(status, STATUS.needPaperwork)) return 6;
  if (is(status, STATUS.toAdmin)) return 7;
  if (is(status, STATUS.invoiced)) return 8;
  if (isProductionStatus(status)) return 3;
  return null;
}

/** The status's own BC lifecycle step (the one it Starts), if any. */
function ownStep(status: string): string | null {
  if (is(status, STATUS.newOrder)) return BC_LIFECYCLE.newOrder;
  if (is(status, STATUS.upcoming)) return BC_LIFECYCLE.upcoming;
  if (is(status, STATUS.readyForPlanning)) return BC_LIFECYCLE.readyForPlanning;
  if (is(status, STATUS.installReady)) return BC_LIFECYCLE.installReady;
  if (is(status, STATUS.installWaiting)) return BC_LIFECYCLE.installWaiting;
  if (is(status, STATUS.needPaperwork)) return BC_LIFECYCLE.needPaperwork;
  return null;
}

const state = (step: string, started: boolean, complete: boolean): BcStepState => ({
  step,
  started: started || complete,
  complete,
  keys: [],
});

/**
 * BC's lifecycle steps for a job on `status` ([] when the status doesn't move
 * the lifecycle). `prev` = the status it just left: an alternative step it
 * was on (Install-Waiting on Product, Vinyl Install Only) is completed when the
 * job moves on past it, and otherwise left alone, so steps a job never used
 * aren't created in BC.
 */
export function lifecycleBcStates(status: string, prev = ""): BcStepState[] {
  const r = statusRank(status);
  if (r === null) return [];
  const own = ownStep(status);
  const out: BcStepState[] = [];
  // The main line: complete once the status is past it; Started while it's the status's own.
  const line: Array<[string, number]> = [
    [BC_LIFECYCLE.newOrder, 0],
    [BC_LIFECYCLE.upcoming, 1],
    [BC_LIFECYCLE.readyForPlanning, 2],
    [BC_LIFECYCLE.installReady, 4],
    [BC_LIFECYCLE.needPaperwork, 6],
  ];
  for (const [step, rank] of line) {
    // Waiting on product is an alternative to Ready for Install Scheduling, not past it.
    if (step === BC_LIFECYCLE.installReady && is(status, STATUS.installWaiting)) continue;
    out.push(state(step, own === step, r > rank));
  }
  // Install-Waiting on Product.
  if (own === BC_LIFECYCLE.installWaiting) out.push(state(BC_LIFECYCLE.installWaiting, true, false));
  else if (r < 4) out.push(state(BC_LIFECYCLE.installWaiting, false, false));
  else if (r > 4 && is(prev, STATUS.installWaiting)) out.push(state(BC_LIFECYCLE.installWaiting, true, true));
  // Vinyl Install Only.
  if (isVinylInstall(status)) out.push(state(BC_LIFECYCLE.vinylInstallOnly, true, false));
  else if (r <= 3) out.push(state(BC_LIFECYCLE.vinylInstallOnly, false, false));
  else if (isVinylInstall(prev)) out.push(state(BC_LIFECYCLE.vinylInstallOnly, true, true));
  return out;
}

/**
 * The stepper's department / Install BC states adjusted for the status:
 *  - BC "Install" (and the main "Installation/Service") is only Started once
 *    the job is at Installation or later — Install being the active stepper
 *    step on "Install - Ready for Planning" / "waiting on product" / Vinyl
 *    Install doesn't start it in BC;
 *  - on "MFG - Vinyl Install", BC "Vinyl" is Complete (the vinyl production is
 *    done; Vinyl Install Only carries the install).
 * Statuses outside the lifecycle leave the stepper's states as they are.
 */
export function adjustForStatus(states: readonly BcStepState[], status: string): BcStepState[] {
  const r = statusRank(status);
  if (r === null) return [...states];
  return states.map((s) => {
    if ((s.step === "Install" || s.step === "Installation/Service") && r < 5 && !s.complete) {
      return { ...s, started: false };
    }
    if (s.step === "Vinyl" && isVinylInstall(status)) return { ...s, started: true, complete: true };
    return s;
  });
}
