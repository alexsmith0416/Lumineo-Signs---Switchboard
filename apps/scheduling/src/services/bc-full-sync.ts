/**
 * "Sync to BC" — bring BC Project Planning in line with the app for every
 * tracked job at once (pure).
 *
 * Live edits already push as people work (store/bc-stepper-push.ts,
 * pushProductionStep / pushInstallStep). This is the catch-up: it computes the
 * whole desired BC state and sends ONLY what differs from the last push that
 * went out for each (job, step, kind), so a re-run after the first is small.
 *
 *  - state    → Started / Complete per BC step, from the stepper (active
 *               department(s) Started — that is what puts a job in a BC tile).
 *  - schedule → Sched_Start / Sched_End / Assigned_To, ONLY for steps that have
 *               cards on the calendar. Unscheduled steps get no dates.
 * Same builders as the live pushes, so both paths always agree.
 */
import type { ScheduleLine } from "../engine/types";
import {
  bcStepForDepartmentName,
  bcStepStates,
  buildStepSchedulePush,
  buildStepStatePush,
  stepWindow,
  type BcPlanningPush,
} from "./bc-planning-sync";

export interface LastPush {
  kind: string;
  jobNo: string;
  planningStep: string;
  started: boolean;
  complete: boolean;
  startDateTime: string | null;
  endDateTime: string | null;
  assignedTo: string;
  createdOn: string;
}

export interface FullSyncInput {
  /** The jobs to sync (tracked jobs). */
  jobNos: readonly string[];
  /** Each job's stepper (buildDepartmentSteps output). */
  stepsByJob: ReadonlyMap<string, ReadonlyArray<{ key: string; state: "completed" | "active" | "included" }>>;
  /** Every production calendar card, and every install card. */
  productionCards: readonly ScheduleLine[];
  installCards: readonly ScheduleLine[];
  departmentName: (departmentId: string) => string | undefined;
  productionResourceNo: (employeeId: string) => string;
  installResourceNo: (employeeId: string) => string;
  /** Every earlier push still in the outbox (pending or synced). */
  lastPushes: readonly LastPush[];
}

export interface FullSyncPlan {
  pushes: BcPlanningPush[];
  jobs: number;
  stateChanges: number;
  scheduleChanges: number;
  unchanged: number;
}

const key = (kind: string, jobNo: string, step: string) => `${kind}|${jobNo}|${step}`;
const sameInstant = (a: string | null, b: string | null) =>
  (a ? new Date(a).getTime() : 0) === (b ? new Date(b).getTime() : 0);

/** True when `p` would change nothing compared with the last push for its key. */
export function alreadySent(p: BcPlanningPush, last: LastPush | undefined): boolean {
  if (!last) return false;
  if (p.kind === "state") return last.started === p.started && last.complete === p.complete;
  return sameInstant(last.startDateTime, p.startDateTime) && sameInstant(last.endDateTime, p.endDateTime) &&
    (last.assignedTo || "") === (p.assignedTo || "");
}

export function planFullSync(input: FullSyncInput): FullSyncPlan {
  // The newest earlier push per (kind, job, step).
  const latest = new Map<string, LastPush>();
  for (const l of input.lastPushes) {
    const k = key(l.kind, l.jobNo, l.planningStep);
    const cur = latest.get(k);
    if (!cur || l.createdOn > cur.createdOn) latest.set(k, l);
  }

  const wanted = new Set(input.jobNos);
  const prodByJob = groupBy(input.productionCards.filter((c) => wanted.has(c.jobNo)), (c) => c.jobNo);
  const installByJob = groupBy(input.installCards.filter((c) => wanted.has(c.jobNo) && !c.shipmentLoadId), (c) => c.jobNo);

  const desired: BcPlanningPush[] = [];
  for (const jobNo of input.jobNos) {
    for (const state of bcStepStates(input.stepsByJob.get(jobNo) ?? [])) {
      const push = buildStepStatePush({ jobNo, state, by: "Sync to BC" });
      if (push) desired.push(push);
    }
    // Production cards grouped by the BC step their department feeds.
    const byStep = groupBy(prodByJob.get(jobNo) ?? [], (c) => bcStepForDepartmentName(input.departmentName(c.departmentId)) ?? "");
    for (const [step, cards] of byStep) {
      if (!step) continue;
      const push = buildStepSchedulePush({ jobNo, step, window: stepWindow(cards, input.productionResourceNo) });
      if (push) desired.push(push);
    }
    const installs = installByJob.get(jobNo);
    if (installs?.length) {
      const push = buildStepSchedulePush({ jobNo, step: "Install", window: stepWindow(installs, input.installResourceNo) });
      if (push) desired.push(push);
    }
  }

  const pushes = desired.filter((p) => !alreadySent(p, latest.get(key(p.kind, p.jobNo, p.planningStep))));
  return {
    pushes,
    jobs: new Set(pushes.map((p) => p.jobNo)).size,
    stateChanges: pushes.filter((p) => p.kind === "state").length,
    scheduleChanges: pushes.filter((p) => p.kind === "schedule").length,
    unchanged: desired.length - pushes.length,
  };
}

function groupBy<T>(items: readonly T[], keyOf: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    let arr = m.get(k);
    if (!arr) m.set(k, (arr = []));
    arr.push(it);
  }
  return m;
}
