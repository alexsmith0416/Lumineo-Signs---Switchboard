import { useJobDeptCompletionStore } from "./job-dept-completion-store";
import { useJobDeptOverrideStore } from "./job-dept-override-store";
import type { FullSyncPlan } from "../services/bc-full-sync";
import { ensureFlowsLoaded } from "./job-flow-store";
import { useJobTrackingStore } from "./job-tracking-store";
import { currentStatus } from "../services/job-tracking";

/**
 * Plan a "Sync to BC" for the given (tracked) jobs: their current stepper from
 * the shared stores + BC planning lines, every board card, and the outbox
 * history — then the diff (services/bc-full-sync.ts). Nothing is sent here.
 */
export async function planBcSync(jobNos: readonly string[]): Promise<FullSyncPlan> {
  const [dv, sync, { jobStepsFor }] = await Promise.all([
    import("../services/dataverse-live"),
    import("../services/bc-full-sync"),
    import("./job-steps"),
  ]);
  await Promise.all([useJobDeptCompletionStore.getState().load(), useJobDeptOverrideStore.getState().load(), ensureFlowsLoaded()]);
  const [stepInfo, snapshot, lastPushes] = await Promise.all([
    dv.allJobStepInfo(),
    dv.fetchSyncSnapshot(),
    dv.fetchLastPushes(),
  ]);
  const completions = useJobDeptCompletionStore.getState().byJob;
  const overrides = useJobDeptOverrideStore.getState().byJob;
  const stepsByJob = new Map(
    jobNos.map((jobNo) => {
      const info = stepInfo.get(jobNo) ?? { production: [], hasInstall: false };
      return [
        jobNo,
        jobStepsFor(jobNo, info, new Set(Object.keys(completions[jobNo] ?? {})), overrides[jobNo] ?? {}),
      ] as const;
    }),
  );
  // Each job's Current Status → its BC lifecycle steps.
  const tracks = new Map(useJobTrackingStore.getState().tracks.map((t) => [t.jobNo, t]));
  const statusByJob = new Map(jobNos.map((jobNo) => [jobNo, currentStatus(tracks.get(jobNo)).status] as const));
  return sync.planFullSync({ jobNos, stepsByJob, lastPushes, statusByJob, ...snapshot });
}

/** Queue a planned sync's pushes; the BCPush_PlanningSteps flow drains them. */
export async function sendBcSync(
  plan: FullSyncPlan,
  onProgress: (done: number, total: number) => void,
): Promise<{ queued: number; failed: number }> {
  const dv = await import("../services/dataverse-live");
  return dv.enqueueBcPushes(plan.pushes, onProgress);
}
