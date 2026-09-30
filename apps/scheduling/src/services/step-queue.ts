/**
 * Job Queue "step groups" — one read-only group per BC Project Planning step,
 * listing the tracked jobs that are ACTIVE in that step (pure).
 *
 * They mirror BC's step tiles: a job shows in a BC tile when its step is
 * Started and not Complete, and Started is exactly the stepper's active
 * department(s) (see bc-planning-sync `bcStepStates`, pushed to BC live and by
 * "Sync to BC"). So the queue reads the stepper directly — no BC round trip —
 * and a job moves to the next group the moment its department is completed.
 *
 *  - Production queue: Substrate Cut/Prep, Fabrication, Routing, Painting,
 *    Vinyl, Final Assembly, Crating.
 *  - Install queues (WK / NEK by the job's install region): Ready for Install =
 *    the Install stage is active (production done).
 * Each card carries the job's BC planning lines for that step (tasks + hours),
 * so dragging it onto the calendar makes a proper card. Jobs already on the
 * calendar for that step stay listed, tagged Scheduled.
 */
import type { QueueItem, QueueKind } from "./job-queue-data";
import { bcStepForDepartmentName, bcStepForKey } from "./bc-planning-sync";
import { DEPT_FLOW, INSTALL_STEP } from "./production-steps";

export interface StepQueueJob {
  jobNo: string;
  name: string;
  description: string;
  /** "WK" / "NEK" — the install region (falls back to the job's region). */
  installRegion: string;
  value: number | null;
}

export interface StepPlanningLine {
  /** Production department name the line belongs to ("Metal Fab"), "" if none. */
  departmentName: string;
  isInstall: boolean;
  description: string;
  hours: number;
}

export interface StepQueueItem extends QueueItem {
  scheduled: boolean;
  step: string;
}

export interface StepQueueGroup {
  step: string;
  items: StepQueueItem[];
}

/** Production BC steps in flow order (Steel + Metal Fab share Fabrication). */
export const PRODUCTION_QUEUE_STEPS: string[] = [
  ...new Set(DEPT_FLOW.map((d) => bcStepForKey(d.key)).filter((s): s is string => !!s)),
];
export const INSTALL_QUEUE_STEP = "Ready for Install";

export const stepQueueItemId = (step: string, jobNo: string) => `step:${step}:${jobNo}`;
export const isStepQueueItemId = (id: string) => id.startsWith("step:");

export function buildStepQueue(input: {
  kind: QueueKind;
  jobs: readonly StepQueueJob[];
  stepsByJob: ReadonlyMap<string, ReadonlyArray<{ key: string; state: "completed" | "active" | "included" }>>;
  linesByJob: ReadonlyMap<string, readonly StepPlanningLine[]>;
  /** `${jobNo}|${bcStep}` for every step that has cards on the calendar. */
  scheduled: ReadonlySet<string>;
  /** A production department id for a department name (card stripe colour). */
  departmentIdFor: (deptName: string) => string;
}): StepQueueGroup[] {
  if (input.kind === "shipping") return [];
  const isInstall = input.kind !== "production";
  const region = input.kind === "install-nek" ? "NEK" : "WK";
  const groups = new Map<string, StepQueueItem[]>(
    (isInstall ? [INSTALL_QUEUE_STEP] : PRODUCTION_QUEUE_STEPS).map((s) => [s, []]),
  );

  for (const job of input.jobs) {
    const steps = input.stepsByJob.get(job.jobNo) ?? [];
    const lines = input.linesByJob.get(job.jobNo) ?? [];
    if (isInstall) {
      if ((job.installRegion || "WK").toUpperCase() !== region) continue;
      if (!steps.some((s) => s.key === INSTALL_STEP.key && s.state === "active")) continue;
      const mine = lines.filter((l) => l.isInstall);
      groups.get(INSTALL_QUEUE_STEP)!.push(
        item(job, INSTALL_QUEUE_STEP, mine, "", input.scheduled.has(`${job.jobNo}|Install`)),
      );
      continue;
    }
    const activeSteps = new Set(
      steps.filter((s) => s.state === "active").map((s) => bcStepForKey(s.key)).filter((s): s is string => !!s && s !== "Install"),
    );
    for (const step of activeSteps) {
      const mine = lines.filter((l) => !l.isInstall && bcStepForDepartmentName(l.departmentName) === step);
      const deptName = mine[0]?.departmentName ?? "";
      groups.get(step)?.push(
        item(job, step, mine, deptName ? input.departmentIdFor(deptName) : "", input.scheduled.has(`${job.jobNo}|${step}`)),
      );
    }
  }

  return [...groups].map(([step, items]) => ({
    step,
    // Unscheduled first, then by job number.
    items: items.sort((a, b) => Number(a.scheduled) - Number(b.scheduled) || a.jobNo.localeCompare(b.jobNo)),
  }));
}

function item(job: StepQueueJob, step: string, lines: readonly StepPlanningLine[], departmentId: string, scheduled: boolean): StepQueueItem {
  return {
    id: stepQueueItemId(step, job.jobNo),
    groupId: `step:${step}`,
    jobNo: job.jobNo,
    customerName: job.name,
    jobDescription: job.description,
    planningLineDescription: lines.map((l) => l.description).filter(Boolean).join("\n"),
    estimatedHours: Math.round(lines.reduce((sum, l) => sum + (l.hours || 0), 0) * 100) / 100 || 8,
    departmentId,
    crewPersons: null,
    crewTrucks: null,
    crewTrips: null,
    installZip: null,
    invoiceAmount: job.value,
    isCustom: false,
    customColor: null,
    customTextColor: null,
    sortOrder: 0,
    scheduled,
    step,
  };
}
